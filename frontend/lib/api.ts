import {
  IncidentPayload,
  IncidentCreateResponse,
  InvestigationStatusResponse,
  ReportResponse,
  RecommendationsResponse,
  IngestResponse,
  ErrorResponse,
} from "../types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Custom Error representation carrying API-specific failure details.
 */
export class ApiError extends Error {
  status: number;
  error_code: string;
  request_id: string;

  constructor(status: number, error_code: string, message: string, request_id: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.error_code = error_code;
    this.request_id = request_id;
  }
}

/**
 * Common handler to parse response JSON and raise detailed ApiError on non-2xx status codes.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: Partial<ErrorResponse> = {};
    try {
      errorData = await response.json();
    } catch {
      // Fallback if response body is not json
    }
    
    // Support nested error payloads (e.g. 422 validations from FastAPI)
    const error_code = errorData.error_code || `HTTP_${response.status}`;
    const message = errorData.message || response.statusText;
    const request_id = errorData.request_id || response.headers.get("X-Request-ID") || "unknown";
    
    throw new ApiError(response.status, error_code, message, request_id);
  }
  return response.json() as Promise<T>;
}

/**
 * Submit raw alert and log entries to begin a workflow investigation.
 */
export async function submitIncident(payload: IncidentPayload): Promise<IncidentCreateResponse> {
  const response = await fetch(`${API_BASE_URL}/incident`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<IncidentCreateResponse>(response);
}

/**
 * Fetch the active stage, progress status, and completed agent outputs of an investigation.
 */
export async function getInvestigation(id: string): Promise<InvestigationStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/incident/${id}`);
  return handleResponse<InvestigationStatusResponse>(response);
}

/**
 * Fetch JSON postmortem report contents or return the Markdown download URL direct path.
 */
export async function getReport(id: string, format?: "markdown"): Promise<any> {
  if (format === "markdown") {
    // Return markdown URL path directly to download in browser
    return `${API_BASE_URL}/report/${id}?format=markdown`;
  }
  const response = await fetch(`${API_BASE_URL}/report/${id}`);
  return handleResponse<ReportResponse>(response);
}

/**
 * Fetch the list of prioritized remediation actions recommended for the incident.
 */
export async function getRecommendations(id: string): Promise<RecommendationsResponse> {
  const response = await fetch(`${API_BASE_URL}/recommendations/${id}`);
  return handleResponse<RecommendationsResponse>(response);
}

/**
 * Upload a document (PDF, MD, TXT) to the RAG knowledge ingestion pipeline.
 */
export async function ingestDocument(file: File): Promise<IngestResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/ingest`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<IngestResponse>(response);
}
