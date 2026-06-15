import logging
import sys
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.models.schemas import (
    CodeGenerationRequest,
    IngestRequest,
    IngestResponse,
    LaunchRequest,
    LaunchResponse,
    AgentResponse,
    ModelInfo,
    HealthResponse,
    ErrorResponse,
)
from app.rag.codebase_rag import CodebaseRAG
from app.agent.workflow import build_workflow
from app.agent.state import AgentState
import subprocess
import os

log_dir = Path(settings.LOG_FILE).parent
log_dir.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(settings.LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Multi-agent code assistant with RAG, LangGraph orchestration, and Ollama integration.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_engine = CodebaseRAG()
agent_workflow = build_workflow()


def _build_model_list() -> list[ModelInfo]:
    models = []
    for name, info in settings.AVAILABLE_MODELS.items():
        models.append(ModelInfo(
            name=name,
            type=info["type"],
            size=info["size"],
            role=info["role"],
            description=info["description"],
        ))
    return models


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        version=settings.VERSION,
        project_name=settings.PROJECT_NAME,
        current_coder=settings.CODER_MODEL,
        current_reviewer=settings.REVIEWER_MODEL,
        available_models=_build_model_list(),
    )


@app.get("/api/v1/models")
def list_models():
    return {
        "current_coder": settings.CODER_MODEL,
        "current_reviewer": settings.REVIEWER_MODEL,
        "current_embedding": settings.EMBEDDING_MODEL,
        "available_models": _build_model_list(),
    }


@app.post("/api/v1/rag/ingest", response_model=IngestResponse)
def ingest_codebase(req: IngestRequest):
    try:
        result = rag_engine.ingest_directory(
            repo_path=req.repo_path,
            extensions=req.languages,
        )
        return IngestResponse(
            status="success",
            files_processed=result["files_processed"],
            chunks_created=result["chunks_created"],
            collection_name=settings.COLLECTION_NAME,
        )
    except NotADirectoryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Ingest failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@app.post("/api/v1/agent/generate", response_model=AgentResponse)
def generate_code(req: CodeGenerationRequest):
    coder_model = req.coder_model or settings.CODER_MODEL
    reviewer_model = req.reviewer_model or settings.REVIEWER_MODEL
    max_iter = min(req.max_iterations or settings.MAX_ITERATIONS, 10)

    if coder_model not in settings.AVAILABLE_MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown coder model: {coder_model}")
    if reviewer_model not in settings.AVAILABLE_MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown reviewer model: {reviewer_model}")

    initial_state: AgentState = {
        "task": req.task,
        "language": req.language,
        "context": "",
        "draft_code": "",
        "review_feedback": "None yet. Write the initial code.",
        "iterations": 0,
        "is_valid": False,
        "errors": [],
        "logs": [f"Job started at {datetime.now().isoformat()}"],
        "coder_model": coder_model,
        "reviewer_model": reviewer_model,
        "ponytail_mode": req.ponytail_mode,
    }

    try:
        old_max = settings.MAX_ITERATIONS
        settings.MAX_ITERATIONS = max_iter
        final_state = agent_workflow.invoke(initial_state)
        settings.MAX_ITERATIONS = old_max
    except Exception as e:
        logger.error("Agent workflow failed: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {str(e)}")

    logs = final_state.get("logs", [])
    logs.append(f"Job completed at {datetime.now().isoformat()}")

    return AgentResponse(
        task=final_state.get("task", req.task),
        language=final_state.get("language", req.language),
        draft_code=final_state.get("draft_code", "# No code generated"),
        review_feedback=final_state.get("review_feedback", "No review performed"),
        iterations=final_state.get("iterations", 0),
        is_valid=final_state.get("is_valid", False),
        logs=logs,
        coder_model=coder_model,
        reviewer_model=reviewer_model,
        ponytail_mode=final_state.get("ponytail_mode", req.ponytail_mode),
    )


@app.get("/api/v1/rag/stats")
def rag_stats():
    return rag_engine.get_collection_stats()


@app.post("/api/v1/rag/clear")
def rag_clear():
    rag_engine.delete_collection()
    return {"status": "cleared", "collection": settings.COLLECTION_NAME}


@app.post("/api/v1/launch", response_model=LaunchResponse)
def launch_project(req: LaunchRequest):
    """Run launch.py inside the given project directory and return the URL/info."""
    project_dir = Path(req.repo_path).resolve()
    launch_script = project_dir / "launch.py"

    if not launch_script.is_file():
        raise HTTPException(status_code=404, detail=f"launch.py not found in {project_dir}")

    try:
        result = subprocess.run(
            [sys.executable, str(launch_script)],
            cwd=str(project_dir),
            capture_output=True, text=True, timeout=10,
        )
        output = result.stdout.strip()
        url = None
        info = None
        launch_type = ""

        for line in output.splitlines():
            if line.startswith("LAUNCH_URL="):
                url = line.split("=", 1)[1].strip()
            elif line.startswith("LAUNCH_INFO="):
                info = line.split("=", 1)[1].strip()
            elif line.startswith("LAUNCH_TYPE="):
                launch_type = line.split("=", 1)[1].strip()

        if result.returncode != 0 and not url and not info:
            raise HTTPException(status_code=500, detail=result.stderr.strip() or "launch.py failed")

        return LaunchResponse(url=url, info=info, launch_type=launch_type)

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Launch script timed out")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Launch failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Launch failed: {str(e)}")
