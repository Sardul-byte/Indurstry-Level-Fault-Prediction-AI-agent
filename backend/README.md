# AI Incident Response Commander — Backend

Python/FastAPI backend for the AI Incident Response Commander platform.

## Requirements

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (recommended) or pip

## Setup

### 1. Clone and enter the backend directory

```bash
cd backend
```

### 2. Create a virtual environment and install dependencies

Using **uv** (recommended):

```bash
uv venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
uv pip install -e ".[dev]"
```

Using **pip**:

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

### 3. Configure environment variables

Copy the example env file and fill in your secrets:

```bash
cp ../.env.example .env
```

Required variables (see `.env.example` for the full list):

| Variable | Description |
|---|---|
| `LLM_PROVIDER` | LLM backend: `gemini` (default), `openai`, or `anthropic` |
| `GEMINI_API_KEY` | API key for Google Gemini |
| `OPENAI_API_KEY` | API key for OpenAI (if using OpenAI provider) |
| `ANTHROPIC_API_KEY` | API key for Anthropic (if using Anthropic provider) |
| `DATABASE_URL` | SQLAlchemy async URL, e.g. `sqlite+aiosqlite:///./dev.db` |
| `QDRANT_URL` | Qdrant instance URL, e.g. `http://localhost:6333` |
| `LANGSMITH_API_KEY` | LangSmith API key for tracing (optional) |

### 4. Start the development server

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs are at `http://localhost:8000/docs`.

## Running Tests

```bash
pytest
```

Run only unit tests:

```bash
pytest tests/unit/
```

Run only API tests:

```bash
pytest tests/api/
```

## Project Layout

```
backend/
├── app/
│   ├── main.py               # FastAPI app factory, lifespan handlers
│   ├── api/
│   │   ├── routes/           # incidents, reports, recommendations endpoints
│   │   └── middleware.py     # request_id injection, error handler
│   ├── core/                 # config, database, error helpers
│   ├── models/               # SQLAlchemy ORM models
│   ├── schemas/              # Pydantic request/response schemas
│   ├── agents/               # One module per agent
│   ├── orchestrator/         # LangGraph StateGraph + InvestigationState
│   ├── rag/                  # Document ingestion + retrieval pipeline
│   ├── llm/                  # LLM provider factory + retry wrapper
│   └── mcp/                  # MCP client registry
└── tests/
    ├── unit/                 # Pure unit + property-based tests (no I/O)
    │   ├── agents/
    │   ├── orchestrator/
    │   ├── rag/
    │   ├── llm/
    │   └── mcp/
    ├── api/                  # FastAPI TestClient / httpx tests
    ├── integration/          # Tests requiring live Qdrant / DB
    └── smoke/                # End-to-end smoke tests
```

## Docker

To run the full stack (API + Qdrant) with Docker Compose from the project root:

```bash
docker-compose up
```

The API is exposed on port 8000 by default (configurable via `API_PORT` in your `.env`).
