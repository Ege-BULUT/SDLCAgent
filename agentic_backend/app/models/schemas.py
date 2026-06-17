from pydantic import BaseModel, Field
from typing import Optional


class CodeGenerationRequest(BaseModel):
    task: str = Field(..., min_length=1, description="The coding task description")
    language: str = Field(default="python", description="Target programming language")
    coder_model: Optional[str] = Field(default=None, description="Model to use for code generation")
    reviewer_model: Optional[str] = Field(default=None, description="Model to use for code review")
    judge_model: Optional[str] = Field(default=None, description="Model to use as LLM judge evaluating review-addressal across iterations")
    max_iterations: int = Field(default=3, ge=1, le=10, description="Max auto-debug iterations")
    ponytail_mode: bool = Field(default=False, description="Enable PonyTail: YAGNI-first minimal code generation")
    session_id: str | None = Field(default=None, description="Workspace session ID to store generated files")


class IngestRequest(BaseModel):
    repo_path: str = Field(..., description="Path to codebase directory to ingest")
    languages: list[str] = Field(default=["python"], description="Languages to ingest")


class IngestResponse(BaseModel):
    status: str
    files_processed: int
    chunks_created: int
    collection_name: str
    logs: list[str] = []


class StructureRequest(BaseModel):
    repo_path: str = Field(..., description="Path to codebase directory to scan")


class RepoItem(BaseModel):
    path: str
    is_dir: bool
    blacklisted: bool


class StructureResponse(BaseModel):
    repo_path: str
    items: list[RepoItem]
    patterns: list[str]


class BlacklistRequest(BaseModel):
    repo_path: str = Field(..., description="Path to codebase directory")
    patterns: list[str] = Field(..., description="Selected ignore patterns")


class BlacklistResponse(BaseModel):
    repo_path: str
    patterns: list[str]
    saved: bool


class AgentResponse(BaseModel):
    task: str
    language: str
    draft_code: str
    review_feedback: str
    iterations: int
    is_valid: bool
    logs: list[str]
    coder_model: str
    reviewer_model: str
    ponytail_mode: bool
    files: dict[str, str] = {}


class ModelInfo(BaseModel):
    name: str
    type: str
    size: str
    role: str
    description: str


class HealthResponse(BaseModel):
    status: str
    version: str
    project_name: str
    current_coder: str
    current_reviewer: str
    available_models: list[ModelInfo]


class LaunchRequest(BaseModel):
    repo_path: str = Field(..., description="Path to the example project to launch")


class LaunchResponse(BaseModel):
    url: str | None = None
    info: str | None = None
    launch_type: str = ""


class WorkspaceInitResponse(BaseModel):
    session_id: str


class WorkspaceSetFilesRequest(BaseModel):
    session_id: str
    files: dict[str, str]
    base_dir: str | None = None


class WorkspaceFileTreeResponse(BaseModel):
    session_id: str
    files: list[str]
    file_count: int
    has_backups: bool
    applied: bool


class WorkspaceFileContentResponse(BaseModel):
    path: str
    content: str


class WorkspaceApplyRequest(BaseModel):
    session_id: str
    base_dir: str | None = None


class WorkspaceApplyResponse(BaseModel):
    ok: bool
    applied: list[str] = []
    errors: list[dict] = []


class WorkspaceRevertResponse(BaseModel):
    ok: bool
    reverted: list[str] = []
    errors: list[dict] = []


class WorkspaceCleanupResponse(BaseModel):
    cleaned: int
    skipped_active: int


class ErrorResponse(BaseModel):
    detail: str
    error_type: Optional[str] = None
