from pydantic import BaseModel, Field
from typing import Optional


class CodeGenerationRequest(BaseModel):
    task: str = Field(..., min_length=1, description="The coding task description")
    language: str = Field(default="python", description="Target programming language")
    coder_model: Optional[str] = Field(default=None, description="Model to use for code generation")
    reviewer_model: Optional[str] = Field(default=None, description="Model to use for code review")
    max_iterations: int = Field(default=3, ge=1, le=10, description="Max auto-debug iterations")
    ponytail_mode: bool = Field(default=False, description="Enable PonyTail: YAGNI-first minimal code generation")


class IngestRequest(BaseModel):
    repo_path: str = Field(..., description="Path to codebase directory to ingest")
    languages: list[str] = Field(default=["python"], description="Languages to ingest")


class IngestResponse(BaseModel):
    status: str
    files_processed: int
    chunks_created: int
    collection_name: str


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


class ErrorResponse(BaseModel):
    detail: str
    error_type: Optional[str] = None
