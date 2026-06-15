import pytest
from pathlib import Path
from app.rag.codebase_rag import CodebaseRAG

TEST_CODEBASE = Path(__file__).parent.parent / "data" / "test_codebase"


@pytest.fixture(autouse=True)
def clean_rag():
    rag = CodebaseRAG()
    rag.delete_collection()
    yield rag
    rag.delete_collection()


def test_rag_ingest_file():
    rag = CodebaseRAG()
    py_file = TEST_CODEBASE / "example.py"
    chunks = rag.ingest_file(str(py_file))
    assert chunks > 0, "Should create at least 1 chunk from example.py"
    stats = rag.get_collection_stats()
    assert stats["total_chunks"] >= chunks


def test_rag_ingest_directory():
    rag = CodebaseRAG()
    result = rag.ingest_directory(str(TEST_CODEBASE))
    assert result["files_processed"] >= 2, "Should process at least .py and .ts files"
    assert result["chunks_created"] > 0, "Should create chunks"
    stats = rag.get_collection_stats()
    assert stats["total_files"] >= 2
    assert stats["total_chunks"] > 0


def test_rag_ingest_directory_with_filter():
    rag = CodebaseRAG()
    result = rag.ingest_directory(str(TEST_CODEBASE), extensions=["py"])
    assert result["files_processed"] == 1, "Should only process .py files"
    assert result["chunks_created"] > 0
    stats = rag.get_collection_stats()
    assert stats["total_files"] == 1


def test_rag_retrieve_context():
    rag = CodebaseRAG()
    rag.ingest_file(str(TEST_CODEBASE / "example.py"))
    context = rag.retrieve_context("hello_world function", k=2)
    assert len(context) > 0, "Should retrieve context"
    assert "hello_world" in context.lower() or "Hello" in context


def test_rag_retrieve_context_empty():
    rag = CodebaseRAG()
    context = rag.retrieve_context("hello world")
    assert context == "", "Should return empty string for empty collection"


def test_rag_retrieve_context_empty_query():
    rag = CodebaseRAG()
    context = rag.retrieve_context("")
    assert context == "", "Should return empty string for empty query"


def test_rag_list_indexed_files():
    rag = CodebaseRAG()
    assert rag.list_indexed_files() == [], "Should be empty initially"
    rag.ingest_file(str(TEST_CODEBASE / "example.py"))
    files = rag.list_indexed_files()
    assert len(files) == 1
    assert "example.py" in files[0]


def test_rag_delete_collection():
    rag = CodebaseRAG()
    rag.ingest_file(str(TEST_CODEBASE / "example.py"))
    assert rag.get_collection_stats()["total_chunks"] > 0
    rag.delete_collection()
    assert rag.get_collection_stats()["total_chunks"] == 0


def test_rag_ingest_nonexistent_file():
    rag = CodebaseRAG()
    chunks = rag.ingest_file("/nonexistent/path/file.py")
    assert chunks == 0, "Should return 0 for nonexistent file"


def test_rag_ingest_nonexistent_directory():
    rag = CodebaseRAG()
    with pytest.raises(NotADirectoryError):
        rag.ingest_directory("/nonexistent/path")
