from typing import TypedDict, Annotated, List


class AgentState(TypedDict):
    task: str
    language: str
    context: str
    draft_code: str
    review_feedback: str
    iterations: int
    is_valid: bool
    errors: List[str]
    logs: List[str]
    coder_model: str
    reviewer_model: str
    ponytail_mode: bool
