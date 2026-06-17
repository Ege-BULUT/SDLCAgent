"""Async streaming agent workflow for SSE-based live output.

Yields SSE-formatted events as the coder and reviewer generate output token-by-token.
"""

import json
import logging
from typing import AsyncGenerator

from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate

from app.core.config import settings
from app.rag.codebase_rag import CodebaseRAG

logger = logging.getLogger(__name__)


def _strip_code_fences(text: str) -> str:
    """Remove leading/trailing markdown code fences if present."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if len(lines) >= 3:
            cleaned = "\n".join(lines[1:-1]).strip()
        elif len(lines) >= 2:
            cleaned = "\n".join(lines[1:]).strip()
    return cleaned


def parse_files_from_code(text: str) -> dict[str, str]:
    """Extract multi-file output from LLM response.
    Format: [FILE: path.ext] content [/FILE]
    Falls back to treating the whole text as a single file if no [FILE:] tags found."""
    import re
    files: dict[str, str] = {}
    pattern = re.compile(r'\[FILE:\s*(.+?)\](.*?)\[/FILE\]', re.DOTALL)
    matches = pattern.findall(text)
    for filepath, content in matches:
        files[filepath.strip()] = _strip_code_fences(content)
    if not files and text.strip():
        files["generated_code.txt"] = _strip_code_fences(text)
    return files


PONYTAIL_RULES = (
    "── PONYTAIL MODE ──────────────────────────────────\n"
    "Before writing code, follow these rules IN ORDER:\n"
    "1. Does this need to exist? → no: skip it (YAGNI)\n"
    "2. Stdlib does it? → use it\n"
    "3. Native platform feature? → use it\n"
    "4. Installed dependency? → use it\n"
    "5. One line? → one line\n"
    "6. Only then: the minimum that works\n"
    "── 80-94% less code. Be the laziest senior dev. ──\n"
    "https://github.com/DietrichGebert/ponytail\n"
)

def _lang_phrase(language: str) -> str:
    return f"expert {language} developer" if language else "expert developer"


BASE_CODER_SYSTEM = (
    "You are an {language_phrase}. "
    "Your current job is to either write the initial code for a task OR rewrite existing code "
    "to address reviewer feedback. "
    "When reviewer feedback is provided, you MUST fix every issue before producing output. "
    "You may output MULTIPLE files if the task requires it. "
    "Use the provided codebase context for reference. "
    "Use this format for EACH file:\n\n"
    "[FILE: path/to/file.ext]\n"
    "code content here...\n"
    "[/FILE]\n\n"
    "If only one file is needed, still use the [FILE:] format. "
    "Put files in appropriate directories (src/, lib/, etc.) based on the project structure. "
    "Do NOT wrap code blocks in markdown triple backticks (```)."
)

CODER_USER_PROMPT = (
    "Task: {task}\n\n"
    "Relevant codebase context:\n{context}\n\n"
    "{previous_draft_section}"
    "── REVIEWER FEEDBACK YOU MUST ADDRESS ─────────────────────────\n"
    "{review_feedback}\n"
    "───────────────────────────────────────────────────────────────\n\n"
    "Instructions:\n"
    "1. Read the existing code and the reviewer feedback carefully.\n"
    "2. Fix EVERY issue the reviewer raised. Do not ignore any comment.\n"
    "3. Keep the existing structure unless a rewrite is explicitly requested.\n"
    "4. Output the complete, corrected code using [FILE: path][/FILE] tags.\n"
    "5. If no code exists yet, write the initial implementation.\n\n"
    "Write the code:"
)

BASE_REVIEWER_SYSTEM = (
    "You are a strict Senior Code Reviewer{language_phrase}. "
    "Analyze the following code for:\n"
    "1. Syntax errors and bugs\n"
    "2. Security vulnerabilities (injection, XSS, path traversal, etc.)\n"
    "3. Edge cases (empty inputs, null values, type mismatches)\n"
    "4. Performance issues\n"
    "5. Best practices and code style\n\n"
    "If the code is perfect and has NO issues whatsoever, "
    "respond with EXACTLY: PASS\n\n"
    "Otherwise, list each issue with severity (HIGH/MEDIUM/LOW) and how to fix it."
)

REVIEWER_USER_PROMPT = (
    "Code to review{language_phrase}:\n\n{draft_code}"
)


def _sse(event: dict) -> str:
    """Format an event dict as an SSE message."""
    return f"data: {json.dumps(event)}\n\n"


JUDGE_SYSTEM = (
    "You are an expert code-review evaluator. Your job is to judge whether the reviewer "
    "feedback was actually addressed by the coder across the iterations."
)

JUDGE_USER_PROMPT = (
    "Original task:\n{task}\n\n"
    "Review the following iteration history. For each iteration, the coder produced code "
    "and the reviewer gave feedback. Then answer:\n"
    "1. Did the final code address the reviewer feedback? (yes/no/partially)\n"
    "2. How well did the review loop improve the code? (score 0-10)\n"
    "3. List any reviewer comments that were ignored or only partially fixed.\n"
    "4. Give a concise final verdict (one paragraph).\n\n"
    "Iteration history (JSON):\n{history}\n\n"
    "Output your evaluation as plain text:"
)


async def stream_agent(
    task: str,
    language: str,
    coder_model: str,
    reviewer_model: str,
    max_iterations: int,
    ponytail_mode: bool = False,
    judge_model: str | None = None,
) -> AsyncGenerator[str, None]:
    """Run agent workflow and yield SSE events token-by-token.

    Events:
      - node_start: {type, node, iteration}
      - coder_token: {type, text, iteration}
      - node_end (coder): {type, node, iteration, draft_code, files, file_list}
      - reviewer_token: {type, text, iteration}
      - node_end (reviewer): {type, node, iteration, feedback, is_valid}
      - error: {type, message}
      - done: {type, iterations, is_valid, draft_code, review_feedback, files}
    """
    # ── Retrieve context (sync — fast) ──
    try:
        rag = CodebaseRAG()
        context = rag.retrieve_context(task, k=3)
        logger.info("Retrieved %d chars of context", len(context) if context else 0)
    except Exception:
        context = ""
        logger.warning("Context retrieval failed, continuing without context")

    # ── Main loop ──
    draft_code = ""
    review_feedback = "No previous feedback. Write the initial version."
    is_valid = False
    iteration = 0
    files: dict[str, str] = {}
    iteration_history: list[dict] = []
    previous_draft_for_prompt = ""

    while iteration < max_iterations and not is_valid:
        iteration += 1

        # ═══════════════ CODER NODE ═══════════════
        yield _sse({"type": "node_start", "node": "coder", "iteration": iteration})

        coder_system = BASE_CODER_SYSTEM
        if ponytail_mode:
            coder_system = PONYTAIL_RULES + coder_system

        try:
            llm = ChatOllama(
                base_url=settings.OLLAMA_BASE_URL,
                model=coder_model,
                temperature=0.1,
                num_predict=4096,
            )
            prompt = ChatPromptTemplate.from_messages([
                ("system", coder_system),
                ("user", CODER_USER_PROMPT),
            ])
            chain = prompt | llm

            draft_code = ""
            code_started = False
            async for chunk in chain.astream({
                "language": language,
                "language_phrase": _lang_phrase(language),
                "task": task,
                "context": context,
                "review_feedback": review_feedback,
                "previous_draft_section": (
                    f"Existing code to revise:\n```\n{previous_draft_for_prompt}\n```\n\n"
                    if previous_draft_for_prompt else ""
                ),
            }):
                content = getattr(chunk, "content", str(chunk))
                if not content:
                    continue
                draft_code += content

                if not code_started:
                    trigger_idx = -1
                    for marker in ("[FILE:", "```"):
                        idx = content.find(marker)
                        if idx != -1 and (trigger_idx == -1 or idx < trigger_idx):
                            trigger_idx = idx
                    if trigger_idx != -1:
                        code_started = True
                        if trigger_idx > 0:
                            thought_part = content[:trigger_idx]
                            yield _sse({"type": "thought_token", "text": thought_part, "iteration": iteration})
                        code_part = content[trigger_idx:]
                        yield _sse({"type": "coder_token", "text": code_part, "iteration": iteration})
                    else:
                        yield _sse({"type": "thought_token", "text": content, "iteration": iteration})
                else:
                    yield _sse({"type": "coder_token", "text": content, "iteration": iteration})

            draft_code = _strip_code_fences(draft_code)

        except Exception as e:
            logger.error("Coder streaming failed: %s", e)
            draft_code = f"# Error generating code: {e}\n# Please check model availability"
            yield _sse({"type": "error", "message": f"Coder node failed: {e}", "iteration": iteration})

        files = parse_files_from_code(draft_code)
        file_list = list(files.keys())
        yield _sse({
            "type": "node_end",
            "node": "coder",
            "iteration": iteration,
            "draft_code": draft_code,
            "files": files,
            "file_list": file_list,
        })

        previous_draft_for_prompt = draft_code

        # ═══════════════ REVIEWER NODE ═══════════════
        if not draft_code.strip() or draft_code.startswith("# Error"):
            review_feedback = "Code generation failed. Cannot review."
            is_valid = False
            yield _sse({
                "type": "node_end",
                "node": "reviewer",
                "iteration": iteration,
                "feedback": review_feedback,
                "is_valid": is_valid,
            })
            continue

        yield _sse({"type": "node_start", "node": "reviewer", "iteration": iteration})

        reviewer_system = BASE_REVIEWER_SYSTEM
        if ponytail_mode:
            reviewer_system = (
                PONYTAIL_RULES
                + "\nAlso flag over-engineering: if the code solves a problem that "
                  "doesn't exist or uses 50 lines where 5 would do, mark it as waste.\n"
                + BASE_REVIEWER_SYSTEM
            )

        try:
            llm = ChatOllama(
                base_url=settings.OLLAMA_BASE_URL,
                model=reviewer_model,
                temperature=0.1,
                num_predict=4096,
            )
            prompt = ChatPromptTemplate.from_messages([
                ("system", reviewer_system),
                ("user", REVIEWER_USER_PROMPT),
            ])
            chain = prompt | llm

            review_feedback = ""
            async for chunk in chain.astream({
                "language": language,
                "language_phrase": _lang_phrase(language),
                "draft_code": draft_code,
            }):
                content = getattr(chunk, "content", str(chunk))
                if content:
                    review_feedback += content
                    yield _sse({"type": "reviewer_token", "text": content, "iteration": iteration})

            is_valid = review_feedback.strip() == "PASS"

        except Exception as e:
            logger.error("Reviewer streaming failed: %s", e)
            review_feedback = f"Review system error: {e}"
            is_valid = False
            yield _sse({"type": "error", "message": f"Reviewer node failed: {e}", "iteration": iteration})

        yield _sse({
            "type": "node_end",
            "node": "reviewer",
            "iteration": iteration,
            "feedback": review_feedback,
            "is_valid": is_valid,
        })

        iteration_history.append({
            "iteration": iteration,
            "draft_code": draft_code,
            "review_feedback": review_feedback,
            "is_valid": is_valid,
        })

    judge_evaluation = "No judge evaluation requested."
    if judge_model:
        yield _sse({"type": "node_start", "node": "judge", "iteration": 1})
        try:
            llm = ChatOllama(
                base_url=settings.OLLAMA_BASE_URL,
                model=judge_model,
                temperature=0.1,
                num_predict=4096,
            )
            prompt = ChatPromptTemplate.from_messages([
                ("system", JUDGE_SYSTEM),
                ("user", JUDGE_USER_PROMPT),
            ])
            chain = prompt | llm

            judge_evaluation = ""
            async for chunk in chain.astream({
                "task": task,
                "history": json.dumps(iteration_history, indent=2),
            }):
                content = getattr(chunk, "content", str(chunk))
                if content:
                    judge_evaluation += content
                    yield _sse({"type": "judge_token", "text": content, "iteration": 1})

        except Exception as e:
            logger.error("Judge streaming failed: %s", e)
            judge_evaluation = f"Judge evaluation error: {e}"
            yield _sse({"type": "error", "message": f"Judge node failed: {e}"})

        yield _sse({
            "type": "node_end",
            "node": "judge",
            "iteration": 1,
            "evaluation": judge_evaluation,
        })

    # ═══════════════ DONE ═══════════════
    yield _sse({
        "type": "done",
        "iterations": iteration,
        "is_valid": is_valid,
        "draft_code": draft_code,
        "review_feedback": review_feedback,
        "judge_evaluation": judge_evaluation if judge_model else None,
        "files": files,
    })
