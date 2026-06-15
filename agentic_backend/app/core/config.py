from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Agentic AI Code Assistant"
    VERSION: str = "1.0.0"

    OLLAMA_BASE_URL: str = "http://localhost:11434"

    CODER_MODEL: str = "qwen2.5-coder:3b"
    REVIEWER_MODEL: str = "qwen3.5:4b"
    EMBEDDING_MODEL: str = "qwen3-embedding:0.6b"

    CHROMA_PERSIST_DIR: str = "./data/chromadb"
    COLLECTION_NAME: str = "codebase"

    MAX_ITERATIONS: int = 3

    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "./logs/agentic_backend.log"

    model_config = {"env_prefix": "AGENTIC_"}

    @property
    def AVAILABLE_MODELS(self) -> dict:
        return {
            "qwen2.5-coder:3b": {
                "type": "local",
                "size": "3B",
                "role": "coder",
                "description": "Qwen 2.5 Coder 3B :fast local code generation",
            },
            "qwen2.5-coder:1.5b": {
                "type": "local",
                "size": "1.5B",
                "role": "coder",
                "description": "Qwen 2.5 Coder 1.5B :lightweight code model",
            },
            "qwen3.5:4b": {
                "type": "local",
                "size": "4B",
                "role": "reviewer",
                "description": "Qwen 3.5 4B :balanced review & reasoning",
            },
            "granite4.1:3b": {
                "type": "local",
                "size": "3B",
                "role": "general",
                "description": "Granite 4.1 3B :fast general purpose",
            },
            "qwen3:4b": {
                "type": "local",
                "size": "4B",
                "role": "general",
                "description": "Qwen 3 4B :general reasoning",
            },
            "qwen3.5:2b": {
                "type": "local",
                "size": "2B",
                "role": "general",
                "description": "Qwen 3.5 2B :lightweight fast model",
            },
            "qwen3-coder:480b-cloud": {
                "type": "cloud",
                "size": "480B",
                "role": "coder",
                "description": "Qwen 3 Coder 480B Cloud :best code generation",
            },
            "gemma4:31b-cloud": {
                "type": "cloud",
                "size": "31B",
                "role": "reviewer",
                "description": "Gemma 4 31B Cloud :deep review & analysis",
            },
        }

    def get_models_for_role(self, role: str) -> dict:
        return {
            k: v for k, v in self.AVAILABLE_MODELS.items() if v["role"] == role
        }

    def get_coder_models(self) -> dict:
        return self.get_models_for_role("coder")

    def get_reviewer_models(self) -> dict:
        return self.get_models_for_role("reviewer")

    def get_general_models(self) -> dict:
        return self.get_models_for_role("general")


settings = Settings()
