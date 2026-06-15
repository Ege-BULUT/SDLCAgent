import pytest
from langgraph.graph import END
from app.agent.workflow import build_workflow, should_continue, retrieve_node, coder_node, reviewer_node, _get_llm
from app.agent.state import AgentState
from app.core.config import settings


@pytest.fixture
def base_state() -> AgentState:
    return {
        "task": "Write a Python function to calculate fibonacci numbers",
        "language": "python",
        "context": "",
        "draft_code": "",
        "review_feedback": "None yet. Write the initial code.",
        "iterations": 0,
        "is_valid": False,
        "errors": [],
        "logs": ["Test start"],
        "coder_model": settings.CODER_MODEL,
        "reviewer_model": settings.REVIEWER_MODEL,
    }


def test_should_continue_valid():
    state: AgentState = {
        "task": "test",
        "language": "python",
        "context": "",
        "draft_code": "",
        "review_feedback": "",
        "iterations": 1,
        "is_valid": True,
        "errors": [],
        "logs": [],
        "coder_model": settings.CODER_MODEL,
        "reviewer_model": settings.REVIEWER_MODEL,
    }
    assert should_continue(state) == END


def test_should_continue_max_iterations():
    state: AgentState = {
        "task": "test",
        "language": "python",
        "context": "",
        "draft_code": "",
        "review_feedback": "",
        "iterations": settings.MAX_ITERATIONS,
        "is_valid": False,
        "errors": [],
        "logs": [],
        "coder_model": settings.CODER_MODEL,
        "reviewer_model": settings.REVIEWER_MODEL,
    }
    assert should_continue(state) == END


def test_should_continue_retry():
    state: AgentState = {
        "task": "test",
        "language": "python",
        "context": "",
        "draft_code": "",
        "review_feedback": "",
        "iterations": 1,
        "is_valid": False,
        "errors": [],
        "logs": [],
        "coder_model": settings.CODER_MODEL,
        "reviewer_model": settings.REVIEWER_MODEL,
    }
    assert should_continue(state) == "coder_node"


def test_workflow_build():
    graph = build_workflow()
    assert graph is not None


@pytest.mark.skipif(
    True,
    reason="Integration test :requires Ollama running with model loaded",
)
def test_coder_node_real_llm(base_state):
    """Run this manually to test real LLM code generation."""
    result = coder_node(base_state)
    assert "draft_code" in result
    assert len(result["draft_code"]) > 10
    assert "iterations" in result
    assert result["iterations"] == 1


def test_coder_node_structure(base_state):
    result = coder_node(base_state)
    assert "draft_code" in result
    assert "iterations" in result
    assert "logs" in result
    assert isinstance(result["draft_code"], str)
    assert isinstance(result["iterations"], int)


def test_reviewer_node_empty_code(base_state):
    base_state["draft_code"] = ""
    result = reviewer_node(base_state)
    assert result["is_valid"] == False
    assert "cannot review" in result["review_feedback"].lower()


def test_reviewer_node_code_with_error(base_state):
    base_state["draft_code"] = "# Error generating code: Model not found"
    result = reviewer_node(base_state)
    assert result["is_valid"] == False


def test_retrieve_node_empty_rag(base_state):
    result = retrieve_node(base_state)
    assert "context" in result
    assert isinstance(result["context"], str)
    assert "logs" in result


def test_get_llm():
    llm = _get_llm(settings.CODER_MODEL)
    assert llm is not None
    assert llm.model == settings.CODER_MODEL
