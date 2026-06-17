# SDLCAgent — Software Development Lifecycle Agent

A multi-agent AI coding assistant that understands multi-language codebases, generates code via LLM agents, reviews it with a second LLM, and iteratively improves it — all through a web UI.

Coder agent writes code, Reviewer agent checks it. If the review finds issues, the Coder rewrites addressing the feedback, up to N iterations.

## Architecture

```
code_snippets/
├── agentic_backend/          # FastAPI + LangGraph + ChromaDB
│   └── app/
│       ├── agent/            # LangGraph workflow (retrieve → coder → reviewer)
│       ├── rag/              # Tree-sitter AST chunking + ChromaDB vector store
│       ├── core/config.py    # Settings: models, ollama URL, chroma path
│       ├── models/schemas.py # Pydantic request/response schemas
│       └── main.py           # FastAPI app with 6 endpoints
├── agentic_frontend/         # React + TypeScript + Vite + Tailwind
│   └── src/
│       ├── components/       # UI components (Header, TaskPanel, CodeDisplay, etc.)
│       ├── api.ts            # Fetch wrapper for all backend endpoints
│       └── types.ts          # TypeScript interfaces
├── examples/                 # Demo projects (Streamlit dashboard, CLI todo)
│   ├── streamlit_dashboard/
│   └── todo_app/
└── launcher.py               # Single command: starts backend + frontend
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12, FastAPI, Uvicorn, Pydantic |
| **AI/Agent** | LangGraph 1.2+, LangChain 1.3+, Ollama |
| **Vector DB** | ChromaDB (codebase RAG) |
| **Code Chunking** | Tree-sitter (Python/Java/C++/C/Kotlin/TS/TSX/JS, HTML/CSS/JSON/Markdown) |
| **Frontend** | React 18, TypeScript 5, Vite 5 |
| **Styling** | Tailwind CSS 3, @tailwindcss/typography |
| **LLM Models** | Qwen2.5-Coder, Qwen3.5, Granite, Gemma (local & cloud) |
| **Formatting** | Black, Ruff (backend) |

## Features

- **Multi-agent loop:** Coder + Reviewer agents iterate up to N rounds. Reviewer can `PASS` or list issues for the Coder to fix.
- **Codebase RAG:** Scan a directory → Tree-sitter AST chunking (function/class/import boundaries) → ChromaDB embedding → semantic retrieval.
- **12 languages for AST chunking:** Python, Java, C++, C, Kotlin, TypeScript, TSX, JavaScript, HTML, CSS, JSON, Markdown.
- **PonyTail mode:** YAGNI-first prompt injection for minimal code output. See [ponytail](https://github.com/anomalyco/ponytail).
- **Launch system:** One-click run for AI-generated Streamlit dashboards or CLI apps.
- **Markdown review:** AI review rendered with syntax highlighting via react-markdown + react-syntax-highlighter.
- **Resizable log panel:** Color-coded execution traces.
- **Demo projects:** Streamlit + Plotly dashboard, CLI todo app.

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- [Ollama](https://ollama.com) with at least one model pulled (e.g., `qwen2.5-coder:3b`)
- (Optional) [uv](https://github.com/astral-sh/uv) for faster dependency management

### Run

```bash
# One command starts both backend and frontend
python launcher.py

# Or separately:
cd agentic_backend
uv run uvicorn app.main:app --reload --port 8001

cd agentic_frontend
npm run dev
```

The launcher finds a free port (starting from 8000), starts the backend, waits for it to be ready, then starts the frontend dev server.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + available models |
| GET | `/api/v1/models` | List models |
| POST | `/api/v1/rag/ingest` | Ingest a codebase directory |
| POST | `/api/v1/agent/generate` | Run multi-agent code generation |
| GET | `/api/v1/rag/stats` | RAG collection stats |
| POST | `/api/v1/rag/clear` | Clear RAG collection |
| POST | `/api/v1/launch` | Run a project via launch.py |

## Tests

```bash
cd agentic_backend
uv run pytest -v
```

52 tests covering API endpoints, agent workflow, RAG, and code chunking.

## License

MIT
