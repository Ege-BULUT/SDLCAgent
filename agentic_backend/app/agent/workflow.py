import logging

from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, START, END

from app.agent.state import AgentState
from app.core.config import settings

logger = logging.getLogger(__name__)

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

BASE_CODER_SYSTEM = (
    "You are an expert {language} developer. "
    "Write clean, production-ready {language} code based on the task. "
    "Use the provided codebase context for reference. "
    "Return ONLY valid {language} code without markdown wrappers or explanations."
)

CODER_USER_PROMPT = (
    "Task: {task}\n\n"
    "Relevant codebase context:\n{context}\n\n"
    "Previous review feedback to address:\n{review_feedback}\n\n"
    "Write the complete {language} code solution:"
)

BASE_REVIEWER_SYSTEM = (
    "You are a strict Senior Code Reviewer with expertise in {language}. "
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
    "Code to review ({language}):\n\n{draft_code}"
)


def _get_llm(model_name: str, temperature: float = 0.1):
    return ChatOllama(
        base_url=settings.OLLAMA_BASE_URL,
        model=model_name,
        temperature=temperature,
        num_predict=4096,
    )


def retrieve_node(state: AgentState) -> dict:
    from app.rag.codebase_rag import CodebaseRAG
    rag = CodebaseRAG()
    context = rag.retrieve_context(state["task"], k=3)
    log_msg = f"Node: Retrieving codebase context for task..."
    if context:
        log_msg += f" found {len(context)} chars of context"
    else:
        log_msg += " no context found (empty codebase)"
    logger.info(log_msg)
    return {
        "context": context,
        "logs": state.get("logs", []) + [log_msg],
    }


def coder_node(state: AgentState) -> dict:
    coder_model = state.get("coder_model", settings.CODER_MODEL)
    language = state.get("language", "python")
    logs = list(state.get("logs", []))

    log_msg = f"Node: Generating {language} code (iteration {state.get('iterations', 0) + 1}) using {coder_model}..."
    logs.append(log_msg)
    logger.info(log_msg)

    ponytail_active = state.get("ponytail_mode", False)
    system_prompt = BASE_CODER_SYSTEM
    if ponytail_active:
        system_prompt = PONYTAIL_RULES + system_prompt
        logs.append(f"PonyTail mode active :YAGNI-first")

    try:
        llm = _get_llm(coder_model)
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", CODER_USER_PROMPT),
        ])
        chain = prompt | llm
        response = chain.invoke({
            "language": language,
            "task": state["task"],
            "context": state.get("context", ""),
            "review_feedback": state.get("review_feedback", "No previous feedback. Write the initial version."),
        })
        draft_code = response.content.strip()
        if draft_code.startswith("```"):
            lines = draft_code.split("\n")
            if len(lines) >= 3:
                draft_code = "\n".join(lines[1:-1]).strip()
            elif len(lines) >= 2:
                draft_code = "\n".join(lines[1:]).strip()
    except Exception as e:
        error_msg = f"Coder node failed: {str(e)}"
        logs.append(error_msg)
        logger.error(error_msg)
        draft_code = f"# Error generating code: {str(e)}\n# Please check model availability"

    return {
        "draft_code": draft_code,
        "iterations": state.get("iterations", 0) + 1,
        "logs": logs,
    }


def reviewer_node(state: AgentState) -> dict:
    reviewer_model = state.get("reviewer_model", settings.REVIEWER_MODEL)
    language = state.get("language", "python")
    draft_code = state.get("draft_code", "")
    logs = list(state.get("logs", []))

    log_msg = f"Node: Reviewing code using {reviewer_model}..."
    logs.append(log_msg)
    logger.info(log_msg)

    if not draft_code.strip() or draft_code.startswith("# Error"):
        logs.append(f"Reviewer: Skipping review :no valid code to review")
        return {
            "review_feedback": "Code generation failed. Cannot review.",
            "is_valid": False,
            "logs": logs,
        }

    ponytail_active = state.get("ponytail_mode", False)
    system_prompt = BASE_REVIEWER_SYSTEM
    if ponytail_active:
        system_prompt = PONYTAIL_RULES + (
            "\nAlso flag over-engineering: if the code solves a problem that "
            "doesn't exist or uses 50 lines where 5 would do, mark it as waste."
        ) + "\n" + BASE_REVIEWER_SYSTEM

    try:
        llm = _get_llm(reviewer_model)
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", REVIEWER_USER_PROMPT),
        ])
        chain = prompt | llm
        response = chain.invoke({
            "language": language,
            "draft_code": draft_code,
        })
        feedback_text = response.content.strip()
        is_valid = feedback_text == "PASS"
        logs.append(f"Reviewer: Code is {'VALID' if is_valid else 'NEEDS FIXES'}")
    except Exception as e:
        error_msg = f"Reviewer node failed: {str(e)}"
        logs.append(error_msg)
        logger.error(error_msg)
        feedback_text = f"Review system error: {str(e)}"
        is_valid = False

    return {
        "review_feedback": feedback_text,
        "is_valid": is_valid,
        "logs": logs,
    }


def should_continue(state: AgentState) -> str:
    if state.get("is_valid", False):
        logger.info("Routing: Code is valid → END")
        return END
    if state.get("iterations", 0) >= settings.MAX_ITERATIONS:
        logger.info("Routing: Max iterations (%d) reached → END", settings.MAX_ITERATIONS)
        return END
    logger.info("Routing: Code invalid, iteration %d/%d → coder_node",
                state.get("iterations", 0), settings.MAX_ITERATIONS)
    return "coder_node"


def build_workflow() -> StateGraph:
    builder = StateGraph(AgentState)

    builder.add_node("retrieve_node", retrieve_node)
    builder.add_node("coder_node", coder_node)
    builder.add_node("reviewer_node", reviewer_node)

    builder.add_edge(START, "retrieve_node")
    builder.add_edge("retrieve_node", "coder_node")
    builder.add_edge("coder_node", "reviewer_node")

    builder.add_conditional_edges(
        "reviewer_node",
        should_continue,
        {END: END, "coder_node": "coder_node"},
    )

    return builder.compile()
