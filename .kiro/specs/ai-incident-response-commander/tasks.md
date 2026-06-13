# Implementation Plan: AI Incident Response Commander

## Overview

This plan scaffolds and implements a production-grade agentic incident response platform end-to-end. The backend is a Python/FastAPI service with a LangGraph multi-agent pipeline, Qdrant-backed RAG, and a modular LLM abstraction layer. The frontend is a Next.js 14 application. Tasks are ordered so every step builds on a runnable, tested foundation — nothing is left unintegrated.

All Python code targets **Python 3.11+** with `asyncio`. Frontend code uses **TypeScript 5**, **Next.js 14 App Router**, **Tailwind CSS**, and **shadcn/ui**.

---

## Tasks

- [x] 1. Project scaffolding and configuration
  - [x] 1.1 Create backend directory structure and pyproject.toml
    - Initialise `backend/` directory with the package layout defined in design section 2.1: `app/api/routes/`, `app/core/`, `app/models/`, `app/schemas/`, `app/agents/`, `app/orchestrator/`, `app/rag/`, `app/llm/`, `app/mcp/`, `tests/unit/`, `tests/api/`, `tests/integration/`, `tests/smoke/`
    - Create `backend/pyproject.toml` with dependency groups: `fastapi[standard]`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `aiosqlite`, `asyncpg`, `pydantic-settings`, `structlog`, `langchain`, `langchain-google-genai`, `langchain-openai`, `langchain-anthropic`, `langgraph`, `qdrant-client`, `sentence-transformers`, `ragas`, `langsmith`, `pymupdf`, `unstructured`, `hypothesis`, `pytest`, `pytest-asyncio`, `httpx`
    - _Requirements: 19.1, 20.1_

  - [x] 1.2 Create Dockerfile, docker-compose.yml, and .env.example
    - Write `backend/Dockerfile` (multi-stage: builder + runtime, non-root user, copies `pyproject.toml` and `app/`)
    - Write `docker-compose.yml` at repo root bringing up `api` (port configurable, default 8000), `qdrant` (port 6333/6334), and a `db` service (PostgreSQL for production profile); include a `healthcheck` for the API using `GET /health`
    - Write `.env.example` listing every environment variable from the design appendix table with placeholder values; include `LLM_PROVIDER`, `LLM_MODEL`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `QDRANT_URL`, `QDRANT_COLLECTION`, `DATABASE_URL`, `LANGSMITH_API_KEY`, `LANGCHAIN_TRACING_V2`, `MCP_TIMEOUT_SECONDS`, `MCP_RESPONSE_CAP`, `RAG_K`, `RAG_SIMILARITY_THRESHOLD`, `API_PORT`, `MAX_PAYLOAD_SIZE_MB`
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

  - [x] 1.3 Initialise Next.js 14 frontend scaffold
    - Run `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir=false`
    - Install shadcn/ui: `npx shadcn-ui@latest init` with default theme
    - Install additional deps: `@radix-ui/react-progress`, `lucide-react`, `fast-check`, `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`
    - Create `frontend/types/api.ts` as an empty placeholder (populated in task 13)
    - Create `frontend/lib/api.ts` and `frontend/lib/polling.ts` as empty placeholders
    - _Requirements: 14.1, 15.1, 16.1, 17.1_

- [ ] 2. Core backend infrastructure
  - [x] 2.1 Implement pydantic-settings config and structured logging
    - Implement `backend/app/core/config.py`: a `Settings` class (inherits `BaseSettings`) with all environment variables from `.env.example`; validate `LLM_PROVIDER` is one of `gemini`, `openai`, `anthropic`; export a module-level `settings` singleton; on missing required variable, log the name and `sys.exit(1)`
    - Implement `backend/app/core/logging.py`: configure `structlog` with JSON renderer, timestamping, log-level filtering, and a `get_logger` helper that binds `request_id` from context var
    - _Requirements: 18.2, 18.3, 19.3, 19.5_

  - [x] 2.2 Implement async database session factory and ORM base
    - Implement `backend/app/core/database.py`: create `AsyncEngine` from `settings.DATABASE_URL`; define `AsyncSessionLocal` factory; expose `get_db()` async generator for FastAPI dependency injection; run `Base.metadata.create_all()` on startup
    - Define `Base = declarative_base()` in `backend/app/models/base.py`
    - _Requirements: 10.5, 10.6_

  - [x] 2.3 Implement FastAPI app factory with request_id middleware and global error handler
    - Implement `backend/app/main.py`: `create_app()` factory with lifespan handler (startup: create DB tables, init Qdrant collection; shutdown: close connections); register all routers; include `request_id` middleware from `app/api/middleware.py`
    - Implement `backend/app/api/middleware.py`: UUID-v4 `request_id` injection into `request.state` and response headers; global exception handler that logs full stacktrace internally and returns sanitised `ErrorResponse` JSON with `error_code`, `message`, `request_id` — no stack traces in response body; enforce `MAX_PAYLOAD_SIZE_MB` 413 rejection
    - Implement `backend/app/core/errors.py`: `ErrorResponse` Pydantic model and helper `make_error_response(error_code, message, request_id)` 
    - _Requirements: 1.3, 18.1, 18.3, 18.4_

  - [ ]* 2.4 Write unit tests for config, logging, and middleware
    - Test that missing required env var triggers `sys.exit(1)` (mock `sys.exit`)
    - Test that `request_id` middleware injects a unique UUID per request
    - Test that the global error handler returns sanitised 500 response with no stack trace in body
    - Test that payloads exceeding `MAX_PAYLOAD_SIZE_MB` get HTTP 413
    - _Requirements: 18.1, 18.3, 18.4, 19.5_

- [ ] 3. SQLAlchemy ORM models and Pydantic schemas
  - [-] 3.1 Implement ORM models
    - Implement `backend/app/models/investigation.py`: `Investigation` model with columns `id` (UUID str PK), `status` (`InvestigationStatus` enum), `stage` (`WorkflowStage` enum), `alert_payload` (JSON), `log_data` (Text), `metadata_` (JSON), `created_at`, `updated_at`, `request_id`; define both enums as Python `enum.Enum`
    - Implement `backend/app/models/agent_output.py`: `AgentOutput` model with `id` (int PK autoincrement), `investigation_id` (FK), `agent_name`, `output` (JSON), `created_at`
    - Implement `backend/app/models/postmortem.py`: `Postmortem` model with `id` (== investigation_id), `sections` (JSON), `status` (`PostmortemStatus` enum), `created_at`
    - Implement `backend/app/models/ragas_metrics.py`: `RAGASMetrics` model with `investigation_id` (PK FK), `faithfulness`, `context_precision`, `context_recall`, `answer_relevance` (all `Float | None`), `computed_at`
    - _Requirements: 2.1, 8.2, 10.5, 13.2_

  - [-] 3.2 Implement Pydantic request/response schemas
    - Implement `backend/app/schemas/incident.py`: `IncidentPayload` (required `alert_data: dict`, `logs: str`, optional `service_name`, `environment`, `timestamp`); `IncidentCreateResponse`; `InvestigationStatusResponse` with `agent_outputs: list[AgentOutputSummary]` capped at 100
    - Implement `backend/app/schemas/agent_outputs.py`: all six agent output models from design section 3.3 — `AlertSummary`, `LogSummary`, `AnomalyEntry`, `FailurePattern`, `ErrorGroup`, `DocumentExcerpt`, `RetrievalContext`, `RootCauseHypothesis`, `RCAResult`, `RemediationStep`, `RemediationList`, `PostmortemSection`, `Postmortem`
    - Implement `backend/app/schemas/responses.py`: `ErrorResponse`, `ReportResponse`, `RecommendationsResponse`
    - _Requirements: 1.2, 2.1, 3.1, 4.4, 5.2, 6.1, 7.1, 8.1, 9.1_

  - [ ]* 3.3 Write property tests for Pydantic schema validation
    - **Property 2: Invalid payloads return 422 with structured field-level errors**
    - **Validates: Requirements 1.2, 1.5**
    - **Property 5: Alert parsing produces valid, bounded AlertSummary for any payload**
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.6**

- [ ] 4. LLM abstraction layer
  - [ ] 4.1 Implement LLMProvider factory with exponential backoff retry
    - Implement `backend/app/llm/provider.py`: `LLMProvider` class with `PROVIDERS` dict mapping `"gemini"` → `ChatGoogleGenerativeAI`, `"openai"` → `ChatOpenAI`, `"anthropic"` → `ChatAnthropic`; `get(model_name=None)` classmethod reads `settings.LLM_PROVIDER` (default `"gemini"`), instantiates the model, wraps with `_with_retry()`; `_with_retry()` applies `.with_retry(retry_if_exception_type=(RateLimitError, ServiceUnavailableError), stop_after_attempt=3, wait_exponential_multiplier=1)`; no provider-specific imports anywhere outside this file
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 4.2 Write property tests for LLM retry behaviour
    - **Property 21: LLM retryable errors trigger exactly 3 retries with exponential backoff**
    - Mock HTTP 429 and 503 responses; assert exactly 3 retry attempts with 1s, 2s, 4s delay pattern
    - Mock non-retryable 4xx/5xx; assert exactly 1 attempt, no retries
    - **Validates: Requirements 12.3, 12.4**

- [ ] 5. MCP Tool Registry
  - [ ] 5.1 Implement MCPRegistry with timeout and response cap enforcement
    - Implement `backend/app/mcp/registry.py`: `MCPRegistry` class with `servers: dict[str, MCPClient]` (keys: `"filesystem"`, `"github"`, `"browser"`); `async call_tool(server, tool, args)` wraps MCP call in `asyncio.wait_for(timeout=settings.MCP_TIMEOUT_SECONDS)`, truncates response to `settings.MCP_RESPONSE_CAP` characters, on `TimeoutError` or `MCPError` logs structured entry `{tool, server, reason, timestamp}` and returns `None`; `initialize()` async method starts MCP subprocesses via stdio transport using the MCP Python SDK
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 5.2 Write property tests for MCP timeout and cap behaviour
    - **Property 20: MCP response injection is always capped at 50,000 characters**
    - Generate random response strings of length [0, 100_000]; assert injected length == `min(len(resp), 50_000)`
    - Assert that timed-out calls return `None` and emit a structured log entry with tool name, error reason, timestamp
    - **Validates: Requirements 11.4, 11.5**

- [ ] 6. RAG pipeline — ingestion
  - [ ] 6.1 Implement document ingestion pipeline
    - Implement `backend/app/rag/ingestion.py`: `ingest_document(file_path, file_content, content_type)` async function; detect format (PDF via PyMuPDF, Markdown/TXT via plain loader); split with `RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=64)`; embed with configured embedding model (`text-embedding-004` if Gemini, `all-MiniLM-L6-v2` as fallback); upsert chunks to Qdrant collection `settings.QDRANT_COLLECTION` storing metadata `{document_name, section, source_path, chunk_index}` per point; track all written point IDs; on any exception or `asyncio.TimeoutError` call `qdrant_client.delete(ids=batch_ids)` and re-raise; wrap entire function in 60-second `asyncio.wait_for`
    - _Requirements: 5.4, 5.5, 5.6_

  - [ ]* 6.2 Write property tests for ingestion atomicity
    - **Property 9: Failed ingestion leaves the Vector_Store unchanged**
    - Mock Qdrant client; inject failure at various points (mid-batch, on embed, on upsert); assert that `delete` is called with all previously written IDs and Vector_Store state is identical to pre-ingestion
    - **Validates: Requirements 5.6**

- [ ] 7. RAG pipeline — retrieval
  - [ ] 7.1 Implement retrieval with cosine similarity filtering and cross-encoder reranking
    - Implement `backend/app/rag/retrieval.py`: `retrieve(alert_summary, log_summary, k=None)` async function; build composite query from `AlertSummary` fields + top anomalies from `LogSummary`; embed query with same model used in ingestion; call `qdrant_client.search(limit=k or settings.RAG_K)`; filter results with `score < settings.RAG_SIMILARITY_THRESHOLD`; if none pass threshold return `RetrievalContext(excerpts=[], retrieval_status="no_relevant_context")`; rerank remaining with `cross-encoder/ms-marco-MiniLM-L-6-v2`; truncate each excerpt to ≤500 words; return `RetrievalContext` with `retrieval_status="ok"`
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 7.2 Write property tests for retrieval bounds
    - **Property 8: Retrieval result count never exceeds K**
    - Generate random K in [1, 20] and mock Qdrant to return up to 50 docs; assert `len(excerpts) <= K`
    - Assert every excerpt word count ≤ 500 and `relevance_score` ∈ [0.0, 1.0]
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 7.3 Write property tests for ingested document round-trip retrievability
    - **Property 10: Ingested documents are retrievable with source text**
    - Ingest a synthetic document; query with text drawn from that document; assert it appears in top-K results
    - **Validates: Requirements 5.4, 5.7**

- [ ] 8. Agent implementations
  - [ ] 8.1 Implement AgentBase abstract class
    - Create `backend/app/agents/base.py`: `AgentBase` ABC with `async run(state: InvestigationState) -> dict[str, Any]` abstract method and `output_schema() -> type[BaseModel]` abstract method; add a `_validate_output(raw)` helper that instantiates `output_schema()(raw)` and raises `ValueError` on failure
    - _Requirements: 10.1, 10.2_

  - [ ] 8.2 Implement Alert_Agent
    - Create `backend/app/agents/alert_agent.py`: `AlertAgent(AgentBase)`; parse `state["alert_payload"]`; use `LLMProvider.get()` to classify alert type (one of six values), severity (one of four values), extract up to 20 impacted services and timestamp; wrap in `asyncio.wait_for(timeout=10)`; on malformed payload set `classification_status="parse_error"`, `severity="low"`, `alert_type="custom"`; on unrecognised type/service set `classification_status="unclassified"`, `alert_type="custom"`, `severity="low"`; on any severity not in enum default to `"low"`; return `AlertSummary`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 8.3 Write unit and property tests for Alert_Agent
    - **Property 5: Alert parsing produces valid, bounded AlertSummary for any payload**
    - Use `@given(alert_payload_strategy())` with ≥200 examples; assert `alert_type` ∈ enum, `severity` ∈ enum, `len(impacted_services) ≤ 20`, `classification_status` ∈ enum
    - Unit tests: valid payload with all fields (correct output schema), null/empty alert payload (parse_error fallback), payload with unrecognised severity (defaults to low), payload with >20 services (truncated to 20)
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.6**

  - [ ] 8.4 Implement Log_Analysis_Agent
    - Create `backend/app/agents/log_analysis_agent.py`: `LogAnalysisAgent(AgentBase)`; support plain text, JSON, and newline-delimited formats; group errors by `{error_type}::{service_name}`; flag anomaly if count > 3; flag failure pattern if signature count ≥ 3; on empty or unrecognised input set `analysis_status="insufficient_data"` with empty maps; emit `LogSummary`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 8.5 Write unit and property tests for Log_Analysis_Agent
    - **Property 6: Log analysis anomaly detection matches the >3 threshold**
    - Use `@given(log_data_with_counts(error_count_range=st.integers(0, 20)))` to generate logs; assert anomaly present iff count > 3, pattern present iff count ≥ 3, exact counts recorded
    - **Property 7: Empty or non-conformant logs produce insufficient_data status**
    - Use `@given(st.one_of(st.just(""), st.text(max_size=10)))` for empty/garbage inputs; assert `analysis_status="insufficient_data"` and empty maps
    - Unit tests: multi-format log parsing (JSON, plain text, NDJSON), boundary count = 3 (pattern yes, anomaly no), boundary count = 4 (both yes)
    - **Validates: Requirements 4.2, 4.3, 4.5, 4.6**

  - [ ] 8.6 Implement Retrieval_Agent
    - Create `backend/app/agents/retrieval_agent.py`: `RetrievalAgent(AgentBase)`; call `retrieve(state["alert_summary"], state["log_summary"])` from `app/rag/retrieval.py`; return `RetrievalContext`
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 8.7 Implement RCA_Agent
    - Create `backend/app/agents/rca_agent.py`: `RCAAgent(AgentBase)`; validate inputs — if `alert_summary` or `log_summary` is None or missing required fields emit `RCAResult(hypotheses=[], analysis_status="invalid_input")`; wrap LLM call in `asyncio.wait_for(timeout=60)`; on timeout propagate `TimeoutError` to trigger `error_handler` with stage `timed_out`; produce ≤5 hypotheses each with `confidence_score` ∈ [0.0, 1.0] and ≥1 evidence item; sort hypotheses by `confidence_score` descending; if best score < 0.2 set `analysis_status="low_confidence"` but still emit highest-scoring hypothesis
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 8.8 Write unit and property tests for RCA_Agent
    - **Property 11: RCA hypotheses are bounded, sorted, and fully evidenced**
    - Use `@given(valid_rca_input_strategy())` ≥100 examples; assert `len(hypotheses) ≤ 5`, scores ∈ [0.0, 1.0], sorted desc, each hypothesis has ≥1 evidence item
    - **Property 12: Null or missing RCA inputs produce invalid_input status with zero confidence**
    - Use `@given(null_or_partial_rca_input_strategy())`; assert `analysis_status="invalid_input"` and all scores == 0.0
    - Unit tests: full valid context → ok status, all confidence < 0.2 → low_confidence status, timeout → TimeoutError raised
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.7**

  - [ ] 8.9 Implement Remediation_Agent
    - Create `backend/app/agents/remediation_agent.py`: `RemediationAgent(AgentBase)`; accept `state["rca_result"]`; generate ≤10 steps; sort first by parent hypothesis `confidence_score` descending, then by category order (`operational` → `configuration` → `code_change`); label each step `confidence="supported"` if parent hypothesis `confidence_score >= 0.4`, else `"speculative"`; if no matching hypothesis set `rationale="no_hypothesis_available"`; return `RemediationList`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 8.10 Write unit and property tests for Remediation_Agent
    - **Property 13: Remediation steps are bounded, correctly sorted, and labelled**
    - Use `@given(rca_result_strategy())` ≥100 examples; assert `len(steps) ≤ 10`, correct primary/secondary sort, correct confidence labels
    - **Property 14: Remediation step rationale is always populated**
    - Assert every step `rationale` is non-empty; for steps with no hypothesis assert `rationale == "no_hypothesis_available"`
    - Unit tests: >10 input hypotheses truncated to 10 steps, all confidence < 0.4 → all speculative, mixed confidence → correct labelling
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

  - [ ] 8.11 Implement Postmortem_Agent
    - Create `backend/app/agents/postmortem_agent.py`: `PostmortemAgent(AgentBase)`; require all five prior agent outputs from state; if any is None set `postmortem_status="incomplete_inputs"` and `missing_inputs=[<names of None outputs>]`; otherwise use LLM to produce exactly 7 sections (Executive Summary, Incident Timeline, Impact Assessment, Root Cause Analysis, Resolution Steps, Lessons Learned, Preventive Actions) each with non-empty `source_agent` citing the originating agent; return `Postmortem`
    - _Requirements: 8.1, 8.6_

  - [ ]* 8.12 Write unit and property tests for Postmortem_Agent
    - **Property 15: Postmortem with complete inputs always has exactly 7 sections**
    - Use `@given(complete_agent_outputs_strategy())` ≥100 examples; assert `len(sections) == 7`, each section has non-empty `heading`, `body`, `source_agent`
    - **Property 16: Incomplete inputs always produce incomplete_inputs status with correct missing list**
    - Use `@given(partial_agent_outputs_strategy())` generating all 31 non-empty subsets missing ≥1 agent; assert `postmortem_status="incomplete_inputs"` and `missing_inputs` contains exactly the absent agent names
    - Unit tests: all inputs present → ready status with 7 sections, one input absent → incomplete_inputs, all inputs absent → incomplete_inputs listing all five agents
    - **Validates: Requirements 8.1, 8.6**

- [ ] 9. LangGraph orchestrator
  - [ ] 9.1 Implement InvestigationState TypedDict and StateGraph
    - Implement `backend/app/orchestrator/state.py`: `InvestigationState` TypedDict exactly as defined in design section 3.4
    - Implement `backend/app/orchestrator/graph.py`: build `StateGraph[InvestigationState]`; add nodes for each of the six agents; wire linear edges `alert_agent → log_analysis_agent → retrieval_agent → rca_agent → remediation_agent → postmortem_agent`; add conditional edges from every node to `error_handler` on exception or schema validation failure; implement `error_handler` node that persists `{agent_name, error_type, message}` to `Investigation.error` field and sets `status="failed"`; before each agent node runs, persist the previous agent's output to `AgentOutput` table (durable persistence before next step); set `status="running"` before first agent; set `status="completed"` after last agent succeeds
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 9.2 Write unit and property tests for orchestrator
    - **Property 18: Orchestrator agent failure propagates correctly for any failing agent**
    - Use `@given(st.sampled_from(["alert_agent","log_analysis_agent","retrieval_agent","rca_agent","remediation_agent","postmortem_agent"]))` to parameterise which agent fails; inject exception; assert `status="failed"`, error record present, no subsequent agents executed
    - **Property 19: Agent outputs are persisted before the next agent is invoked**
    - Mock DB; assert `AgentOutput` row for agent N exists in DB at the moment agent N+1 starts
    - Unit tests: full happy-path pipeline completes with status=completed, storage failure mid-pipeline sets status=failed, RCA timeout sets stage=timed_out
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**

- [ ] 10. FastAPI route handlers
  - [ ] 10.1 Implement POST /incident and GET /incident/{id} routes
    - Implement `backend/app/api/routes/incidents.py`:
      - `POST /incident`: validate `IncidentPayload` (422 on failure); create `Investigation` record with `status="pending"`, `stage="triaging"`, `request_id` from middleware; return `IncidentCreateResponse` with HTTP 202; enqueue orchestrator via `BackgroundTasks.add_task()`
      - `GET /incident/{id}`: validate ID is UUID-v4 format (400 if not); fetch `Investigation` (404 if not found); return `InvestigationStatusResponse` with `agent_outputs` list capped at 100 items
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3_

  - [ ] 10.2 Implement GET /report/{id} route
    - Implement `backend/app/api/routes/reports.py`:
      - `GET /report/{id}`: fetch `Postmortem` by `id` (404 if investigation not found); if `status != "ready"` return HTTP 202 with `report_status="pending"`; if `?format=markdown` render all 7 sections as Markdown file with all source references and return as `text/markdown` download named `postmortem-{id}.md`; else return JSON response
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [ ] 10.3 Implement GET /recommendations/{id} and POST /ingest routes
    - Implement `backend/app/api/routes/recommendations.py`:
      - `GET /recommendations/{id}`: fetch investigation (404 if not found); if `status="failed"` return 422 with `recommendations_status="failed"`; if Remediation_Agent not yet complete return 202 with `recommendations_status="pending"`; else return full `RemediationList` ordered by priority rank descending with `action_category`, `rationale`, `confidence` label
    - Implement `backend/app/api/routes/ingest.py`: `POST /ingest` accepting multipart file upload (PDF/MD/TXT); validate format; enqueue `ingest_document()` via `BackgroundTasks`; return 202 with ingestion job ID
    - Add `GET /health` endpoint returning `{"status": "ok"}` with HTTP 200
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 5.4, 5.5_

  - [ ]* 10.4 Write API property tests for routes
    - **Property 1: Valid incident submission returns 202 with an ID and starts asynchronously**
    - Use `@given(valid_incident_payload())` ≥100 examples; assert HTTP 202, non-empty `investigation_id`, follow-up GET returns `status ∈ {pending, in_progress}` (never completed/failed immediately)
    - **Property 2: Invalid payloads return 422 with structured field-level errors**
    - Use `@given(invalid_incident_payload())` covering missing fields, wrong types, empty required strings; assert HTTP 422 and structured error list with field names
    - **Property 3: Non-existent investigation IDs return 404**
    - Use `@given(st.uuids())` generating UUIDs not in DB; assert 404 for GET /incident, /report, /recommendations
    - **Property 4: Malformed investigation IDs return 400**
    - Use `@given(malformed_id_strategy())` (empty, invalid chars, wrong length); assert 400 for GET /incident/{id}
    - **Property 22: All error HTTP responses contain error_code, message, and request_id**
    - For all 4xx/5xx responses generated above, assert body has non-empty `error_code`, `message`, `request_id`; 500 responses have no stack traces in `message`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 9.1–9.4, 18.1, 18.4**

- [ ] 11. Checkpoint — backend integration
  - Ensure all backend unit and API tests pass: `pytest tests/unit tests/api --tb=short`
  - Verify `docker-compose up` starts API, Qdrant, and DB; `GET /health` returns 200 within 60 s
  - Ask the user if questions arise before proceeding to RAGAS integration.

- [ ] 12. RAGAS + LangSmith evaluation integration
  - [ ] 12.1 Implement RAGAS metric computation and persistence
    - Implement `backend/app/evaluation/ragas_evaluator.py`: `evaluate_investigation(investigation_id)` async function; retrieve `RetrievalContext` and final `Postmortem` for the investigation; call RAGAS `evaluate()` for faithfulness, context_precision, context_recall, answer_relevance; handle per-metric failure by catching exceptions, logging `{metric_name, reason}`, and persisting `null` for that metric; persist all results to `RAGASMetrics` table; call this function after every investigation reaches `completed` or `failed` state
    - _Requirements: 13.1, 13.2, 13.4_

  - [ ] 12.2 Implement LangSmith tracing emission
    - In `backend/app/orchestrator/graph.py`, if `settings.LANGCHAIN_TRACING_V2 == "true"`, wrap each agent node invocation with LangSmith `RunTree` or rely on LangChain auto-tracing; emit agent execution traces, token counts, per-stage latency in ms (triaging, root_cause_analysis, remediation, verification), and tool usage events
    - _Requirements: 13.3_

  - [ ]* 12.3 Write unit tests for RAGAS evaluator
    - Test that per-metric failure persists `null` without blocking other metrics
    - Test that `RAGASMetrics` row is created for every completed/failed investigation
    - Test that RAGAS is not called when investigation is still `in_progress`
    - _Requirements: 13.1, 13.2, 13.4_

- [ ] 13. Frontend types, API client, and polling hook
  - [ ] 13.1 Implement TypeScript API types
    - Populate `frontend/types/api.ts` with TypeScript interfaces mirroring all Pydantic schemas: `IncidentPayload`, `IncidentCreateResponse`, `InvestigationStatusResponse`, `AgentOutputSummary`, `AlertSummary`, `LogSummary`, `RetrievalContext`, `DocumentExcerpt`, `RCAResult`, `RootCauseHypothesis`, `RemediationList`, `RemediationStep`, `Postmortem`, `PostmortemSection`, `ErrorResponse`; include `InvestigationStatus` and `WorkflowStage` union types
    - _Requirements: 14.1, 15.1, 16.1, 17.1_

  - [ ] 13.2 Implement typed API client
    - Populate `frontend/lib/api.ts`: `submitIncident(payload)`, `getInvestigation(id)`, `getReport(id, format?)`, `getRecommendations(id)`, `ingestDocument(file)` — all typed with interfaces from `types/api.ts`; use `fetch` with proper error handling; throw typed errors preserving `status`, `error_code`, `message`, `request_id` on non-2xx responses
    - _Requirements: 14.2, 14.3, 14.4, 15.3, 15.4, 16.1, 17.2_

  - [ ] 13.3 Implement usePolling hook
    - Populate `frontend/lib/polling.ts`: `usePolling<T>(fetchFn, intervalMs, stopCondition)` hook; calls `fetchFn` every `intervalMs`; stops when `stopCondition(data)` returns true; sets `isStale` flag on fetch failure but continues loop; exposes `{data, isStale, error, stop}`
    - _Requirements: 15.3, 15.4, 17.3, 17.4_

  - [ ]* 13.4 Write property tests for usePolling hook
    - **Validates: frontend Property 23 (polling interval invariants from design testing strategy)**
    - Use `fast-check`: generate random interval values [1000, 10000] ms and stop conditions; assert hook never polls faster than configured interval; assert polling stops when `stopCondition` returns true; assert `isStale` is set on error but loop continues
    - _Requirements: 15.3, 15.4_

- [ ] 14. Frontend pages and layout
  - [ ] 14.1 Implement root layout, home page redirect, and navigation
    - Implement `frontend/app/layout.tsx`: global providers (query client if needed), Tailwind base styles, `<html lang="en">`
    - Implement `frontend/app/page.tsx`: redirect to `/submit`
    - Create shared navigation component showing active route
    - _Requirements: 14.1_

  - [ ] 14.2 Implement Incident Submission page
    - Implement `frontend/app/submit/page.tsx` using `IncidentForm` component; call `submitIncident()`; on success navigate to `/investigation/{id}`; on 422 render inline field errors; on other errors show general error banner at top of form
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [ ] 14.3 Implement Investigation Dashboard page
    - Implement `frontend/app/investigation/[id]/page.tsx`: load investigation via `usePolling(getInvestigation, 5000, (d) => d.status === 'completed' || d.status === 'failed')`; display `WorkflowStageBar`, six `AgentStatusCard` components, `RetrievedEvidencePanel`; show stale-data banner on poll failure; navigate to root-cause/recommendations/postmortem tabs when investigation completes
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ] 14.4 Implement Root Cause View page
    - Implement `frontend/app/investigation/[id]/root-cause/page.tsx`: fetch RCA data from investigation response; render ranked `HypothesisCard` list with `confidence_score` (2 decimal places) and `EvidenceList`; disable page if investigation not `completed` with "unavailable until investigation completes" message; show empty-state message when hypothesis list is empty
    - _Requirements: 16.1, 16.3, 16.4, 16.5_

  - [ ] 14.5 Implement Recommendation View page
    - Implement `frontend/app/investigation/[id]/recommendations/page.tsx`: fetch from `GET /recommendations/{id}`; render `RemediationStepCard` list with category, rationale, confidence label; disable when investigation not `completed`; show empty-state when list is empty
    - _Requirements: 16.2, 16.3, 16.4, 16.5_

  - [ ] 14.6 Implement Postmortem View and Export page
    - Implement `frontend/app/investigation/[id]/postmortem/page.tsx`: poll `getReport(id)` every 10 seconds max 30 attempts; render seven `PostmortemSection` components with distinct heading/body styling; include `ExportButton` that calls `getReport(id, 'markdown')` and triggers browser download of `postmortem-{id}.md`; show loading indicator while polling; after 30 failed attempts show timeout error message
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [ ] 15. Frontend components
  - [ ] 15.1 Implement submission components
    - Implement `frontend/components/submission/IncidentForm.tsx`: form with controlled inputs for alert text/JSON (textarea, max 10,000 chars), log file upload (`.txt`/`.json` only, max 10 MB), optional service name, environment, and ISO 8601 timestamp; client-side validation before API call; `onSuccess(id)` callback; renders `FieldError` components adjacent to each failing field
    - Implement `frontend/components/submission/FieldError.tsx`: renders inline error message for a single field
    - _Requirements: 14.1, 14.2, 14.3_

  - [ ] 15.2 Implement dashboard components
    - Implement `frontend/components/dashboard/AgentStatusCard.tsx`: displays agent name, status badge (pending/running/completed/failed with distinct colours), and truncated output summary ≤500 characters with `data-testid="output-summary"`
    - Implement `frontend/components/dashboard/WorkflowStageBar.tsx`: horizontal progress bar showing five workflow stages; highlights active stage; marks completed stages
    - Implement `frontend/components/dashboard/RetrievedEvidencePanel.tsx`: renders retrieved `DocumentExcerpt` list with document name, section, and relevance score; shown only when Retrieval_Agent stage is complete
    - _Requirements: 15.1, 15.2, 15.5_

  - [ ] 15.3 Implement RCA, recommendation, and postmortem components
    - Implement `frontend/components/rca/HypothesisCard.tsx`: renders hypothesis text, confidence score as a formatted float, and evidence list via `EvidenceList`
    - Implement `frontend/components/rca/EvidenceList.tsx`: bulleted list of evidence strings
    - Implement `frontend/components/recommendations/RemediationStepCard.tsx`: renders action text, category badge, rationale text, and confidence label (`supported` or `speculative`) with colour coding
    - Implement `frontend/components/postmortem/PostmortemSection.tsx`: renders a single section with a visually distinct `<h2>` heading and body text
    - Implement `frontend/components/postmortem/ExportButton.tsx`: button that triggers Markdown download; handles loading state during fetch
    - _Requirements: 16.1, 16.2, 17.1, 17.2_

  - [ ]* 15.4 Write frontend component tests
    - Test `IncidentForm`: valid submission calls API, 422 response shows inline field errors adjacent to correct fields, non-422 error shows top-level banner
    - Test `AgentStatusCard`: output summaries are truncated to ≤500 chars (property test with `fast-check`)
    - Test `WorkflowStageBar`: correct stage highlighted for each `WorkflowStage` value
    - Test `ExportButton`: clicking triggers download with filename `postmortem-{id}.md`
    - Test Postmortem page: shows loading indicator when report pending, timeout error message after 30 failed polls, renders all 7 sections when ready
    - _Requirements: 14.2, 14.3, 15.1, 17.1, 17.2, 17.3, 17.4_

  - [ ]* 15.5 Write frontend property tests
    - **Postmortem render completeness**: use `fast-check` to generate `Postmortem` objects with 7 sections; render `PostmortemView`; assert all 7 section headings and bodies are in the DOM
    - **Output summary truncation**: use `fast-check` `fc.string({ maxLength: 2000 })` as agent output; assert `data-testid="output-summary"` text ≤ 500 chars
    - **Postmortem Markdown export sections**: use `fast-check` to generate complete `Postmortem`; call `getReport(id, 'markdown')` (mocked); assert response contains all 7 section headings
    - _Requirements: 8.5, 15.1, 17.1_

- [ ] 16. Checkpoint — full stack integration
  - Run all backend tests: `pytest tests/ --ignore=tests/integration --ignore=tests/smoke -x`
  - Run all frontend tests: `cd frontend && npx vitest run`
  - Verify the full docker-compose stack starts and `GET /health` responds within 60 s
  - Ask the user if questions arise before proceeding to integration and smoke tests.

- [ ] 17. Integration and smoke tests
  - [ ] 17.1 Write RAG ingestion integration tests
    - Test that ingesting a PDF/MD/TXT document completes within 60 s (with real Qdrant)
    - Test round-trip: ingest a document, query with its source text, assert it appears in top-K (Property 10)
    - _Requirements: 5.5, 5.7_

  - [ ]* 17.2 Write agent timeout integration tests
    - Test Alert_Agent times out at 10 s: mock LLM to delay 11 s; assert `TimeoutError` propagates and pipeline sets status=failed
    - Test RCA_Agent times out at 60 s: mock LLM delay; assert `stage="timed_out"`, `status="failed"`
    - _Requirements: 3.5, 6.5, 6.6_

  - [ ]* 17.3 Write orchestrator storage failure tests
    - Mock DB to raise on every write attempt; assert `status="failed"` with storage error logged
    - Mock DB to fail only after agent N's write; assert agents 1..N-1 outputs are still retrievable
    - _Requirements: 10.6_

- [ ] 18. Final checkpoint — all tests pass
  - Run full test suite: `pytest tests/ -x --tb=short`
  - Run frontend tests: `cd frontend && npx vitest run --coverage`
  - Confirm 100% pass rate on all non-integration tests; confirm integration tests pass with running services
  - Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property-based tests use **Hypothesis** (Python backend) and **fast-check** (TypeScript frontend)
- Each property test is annotated with the property number from the design document and the requirements clause it validates
- Checkpoints at tasks 11, 16, and 18 ensure every major integration point is validated before proceeding
- The orchestrator (task 9) depends on all six agents (task 8) being complete before wiring
- Frontend pages (task 14) depend on components (task 15.1–15.3) being available — implement components first within each page's sub-tasks
- Docker services (Qdrant, PostgreSQL) must be running for integration tests in task 17

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3"] },
    { "id": 3, "tasks": ["2.4", "3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3", "4.1", "8.1"] },
    { "id": 5, "tasks": ["4.2", "5.1", "6.1", "7.1"] },
    { "id": 6, "tasks": ["5.2", "6.2", "7.2", "7.3", "8.2", "8.4"] },
    { "id": 7, "tasks": ["8.3", "8.5", "8.6"] },
    { "id": 8, "tasks": ["8.7", "8.9", "8.11"] },
    { "id": 9, "tasks": ["8.8", "8.10", "8.12"] },
    { "id": 10, "tasks": ["9.1"] },
    { "id": 11, "tasks": ["9.2", "10.1"] },
    { "id": 12, "tasks": ["10.2", "10.3"] },
    { "id": 13, "tasks": ["10.4", "12.1"] },
    { "id": 14, "tasks": ["12.2", "12.3", "13.1"] },
    { "id": 15, "tasks": ["13.2", "13.3"] },
    { "id": 16, "tasks": ["13.4", "14.1", "15.1", "15.2", "15.3"] },
    { "id": 17, "tasks": ["14.2", "14.3"] },
    { "id": 18, "tasks": ["14.4", "14.5", "14.6"] },
    { "id": 19, "tasks": ["15.4", "15.5", "17.1"] },
    { "id": 20, "tasks": ["17.2", "17.3"] }
  ]
}
```
