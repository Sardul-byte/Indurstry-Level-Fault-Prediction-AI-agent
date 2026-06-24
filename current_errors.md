# Operational & Setup Issues Status

This document lists the active operational and setup-related errors, warnings, and limitations currently observed in the local environment of the AI Incident Response Commander (Failure System). 

---

## 1. Missing LLM Credentials (Gemini API Key / Google ADC)

### Error / Warning Message
```text
LLM provider 'gemini' selected but GEMINI_API_KEY is empty. LLM calls will fail unless a key is supplied at runtime.
```
```text
google.auth.exceptions.DefaultCredentialsError: Your default credentials were not found. To set up Application Default Credentials, see https://cloud.google.com/docs/authentication/external/set-up-adc for more information.
```

### Impact
* **LLM Agents (Alert, Log, RCA, Remediation, Postmortem):** Real LLM invocations fail. The system falls back cleanly to local heuristic and rule-based parsing outputs (e.g. `classification_status="parse_error"`, `analysis_status="low_confidence"` with placeholder root cause hypotheses and remediation steps).
* **Ragas Evaluator:** Ragas evaluation metrics loop fails to initialize, resulting in `ragas_setup_failed` messages and leaving Ragas metrics columns in the DB populated with `NULL`.

### How to Fix
1. Get a Gemini API Key from Google AI Studio.
2. Set it as an environment variable in your terminal before launching the backend server:
   ```powershell
   $env:GEMINI_API_KEY="your_api_key_here"
   ```
   *(Alternatively, add `GEMINI_API_KEY=your_api_key_here` to the `backend/.env` file).*

---

## 2. Qdrant Vector Database Connection Refused

### Error / Warning Message
```text
2026-06-24T19:38:17.326571Z [warning  ] retrieval_qdrant_error_falling_back error=[WinError 10061] No connection could be made because the target machine actively refused it
```

### Impact
* **Retrieval Agent (RAG):** The retrieval stage cannot connect to the vector store (`localhost:6333`) to fetch matching SRE runbooks or historical logs. 
* **Fallback Status:** The agent handles this gracefully by returning an empty list of excerpts with status `no_relevant_context`, allowing the pipeline to proceed without crashing.

### How to Fix
1. Start the Docker Desktop application on your host.
2. Start the Qdrant container using docker-compose:
   ```bash
   docker-compose up -d qdrant
   ```

---

## 3. Ragas Evaluator Setup Failure

### Error / Warning Message
```text
2026-06-24T19:42:47.502799Z [error    ] ragas_setup_failed error=Your default credentials were not found. To set up Application Default Credentials, see https://cloud.google.com/docs/authentication/external/set-up-adc for more information.
```

### Impact
* **Observability:** Ragas evaluation requires an active LLM setup to compute metrics (faithfulness, answer relevance, context recall, and precision). Due to missing credentials, metrics cannot be computed and the setup fails gracefully.

### How to Fix
* Resolve the LLM credentials issue described in **Issue 1**, and the Ragas evaluator will initialize and run automatically at the end of each investigation pipeline.
