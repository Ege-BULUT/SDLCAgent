import logging
from pathlib import Path
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_ollama import OllamaEmbeddings

from app.rag.code_chunker import chunk_code
from app.rag.agentignore import read_agentignore, is_ignored

from app.core.config import settings

logger = logging.getLogger(__name__)

LANGUAGE_EXT_MAP = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "javascript",
    ".java": "java",
    ".cpp": "cpp",
    ".cxx": "cpp",
    ".cc": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".rs": "rust",
    ".go": "go",
    ".rb": "ruby",
    ".swift": "swift",
    ".php": "php",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "css",
    ".json": "json",
    ".md": "markdown",
    ".mdx": "markdown",
}

LANG_TO_EXT: dict[str, list[str]] = {}
for ext, lang in LANGUAGE_EXT_MAP.items():
    LANG_TO_EXT.setdefault(lang, []).append(ext)


class CodebaseRAG:
    def __init__(self):
        self.ollama_base_url = settings.OLLAMA_BASE_URL
        self.embedding_model = settings.EMBEDDING_MODEL
        self.persist_dir = settings.CHROMA_PERSIST_DIR
        self.collection_name = settings.COLLECTION_NAME

        self.embeddings = OllamaEmbeddings(
            base_url=self.ollama_base_url,
            model=self.embedding_model,
        )

        self.chroma_client = chromadb.PersistentClient(
            path=self.persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

        self.collection = self.chroma_client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            "ChromaDB initialized: collection='%s', embedding='%s', persist='%s'",
            self.collection_name, self.embedding_model, self.persist_dir,
        )

    def _ensure_collection(self):
        try:
            self.collection = self.chroma_client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
        except Exception:
            pass

    def ingest_file(self, file_path: str) -> int:
        self._ensure_collection()
        path = Path(file_path)
        if not path.is_file():
            logger.warning("File not found: %s", file_path)
            return 0

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            logger.error("Failed to read file %s: %s", file_path, e)
            return 0

        lang = LANGUAGE_EXT_MAP.get(Path(file_path).suffix.lower(), "python")
        chunks = chunk_code(content, lang)

        if not chunks:
            return 0

        chunk_ids = [f"{file_path}#chunk{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "file_path": file_path,
                "extension": path.suffix,
                "language": path.suffix.lstrip("."),
                "chunk_index": i,
                "total_chunks": len(chunks),
            }
            for i in range(len(chunks))
        ]

        self.collection.add(
            documents=chunks,
            ids=chunk_ids,
            metadatas=metadatas,
        )
        logger.info("Ingested %s: %d chunks", file_path, len(chunks))
        return len(chunks)

    def ingest_directory(self, repo_path: str, extensions: Optional[list[str]] = None) -> dict:
        base = Path(repo_path)
        if not base.is_dir():
            raise NotADirectoryError(f"Directory not found: {repo_path}")

        # Map language names (e.g. 'python') to real file extensions (e.g. '.py')
        if extensions:
            exts = set()
            for lang in extensions:
                if lang.startswith("."):
                    exts.add(lang.lower())
                elif mapped := LANG_TO_EXT.get(lang):
                    exts.update(mapped)
                else:
                    exts.add(f".{lang}")
            exts = sorted(exts)
        else:
            exts = list(LANGUAGE_EXT_MAP.keys())

        log_messages = []
        files_processed = 0
        total_chunks = 0
        processed_files = []

        log_messages.append(f"Scanning {base} for {exts} files ...")
        patterns = read_agentignore(repo_path)
        for fpath in base.rglob("*"):
            if not fpath.is_file():
                continue
            rel = str(fpath.relative_to(base))
            if is_ignored(rel, patterns):
                continue
            if fpath.suffix.lower() in exts:
                chunks = self.ingest_file(str(fpath))
                if chunks > 0:
                    files_processed += 1
                    total_chunks += chunks
                    processed_files.append(str(fpath))
                    log_messages.append(f"  {fpath.name} → {chunks} chunks")

        log_messages.append(f"Done: {files_processed} files, {total_chunks} chunks")
        for msg in log_messages:
            logger.info(msg)

        result = {
            "files_processed": files_processed,
            "chunks_created": total_chunks,
            "processed_files": processed_files,
            "logs": log_messages,
        }
        return result

    def retrieve_context(self, query: str, k: int = 3) -> str:
        self._ensure_collection()
        if not query.strip():
            return ""

        try:
            results = self.collection.query(query_texts=[query], n_results=k)
        except Exception as e:
            logger.error("ChromaDB query failed: %s", e)
            return ""

        if not results or not results.get("documents") or not results["documents"][0]:
            logger.info("No results found for query: %s", query[:50])
            return ""

        documents = results["documents"][0]
        metadatas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(documents)

        context_parts = []
        for i, (doc, meta) in enumerate(zip(documents, metadatas)):
            source = meta.get("file_path", "unknown") if meta else "unknown"
            context_parts.append(f"# Source: {source}\n{doc}")

        context = "\n\n---\n\n".join(context_parts)
        logger.info("Retrieved %d chunks for query: %s", len(documents), query[:50])
        return context

    def list_indexed_files(self) -> list[str]:
        self._ensure_collection()
        try:
            results = self.collection.get(limit=10000)
            if not results or not results.get("metadatas"):
                return []
            files = set()
            for meta in results["metadatas"]:
                if meta and "file_path" in meta:
                    files.add(meta["file_path"])
            return sorted(files)
        except Exception as e:
            logger.error("Failed to list indexed files: %s", e)
            return []

    def get_collection_stats(self) -> dict:
        self._ensure_collection()
        try:
            count = self.collection.count()
            files = self.list_indexed_files()
            return {
                "total_chunks": count,
                "total_files": len(files),
                "files": files,
                "collection_name": self.collection_name,
                "embedding_model": self.embedding_model,
            }
        except Exception as e:
            logger.error("Failed to get collection stats: %s", e)
            return {"total_chunks": 0, "total_files": 0, "files": [], "error": str(e)}

    def delete_collection(self):
        try:
            self.chroma_client.delete_collection(self.collection_name)
            self.collection = self.chroma_client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info("Collection '%s' cleared", self.collection_name)
        except Exception as e:
            logger.error("Failed to delete collection: %s", e)
