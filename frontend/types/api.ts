/**
 * TypeScript type definitions mirroring FastAPI backend Pydantic schemas.
 */

export interface IncidentPayload {
  alert_data: Record<string, any>;
  logs: string;
  service_name?: string | null;
  environment?: string | null;
  timestamp?: string | null; // ISO 8601 string
}

export interface IncidentCreateResponse {
  investigation_id: string;
  status: string;
}

export interface AgentOutputSummary {
  agent_name: string;
  output: Record<string, any>;
}

export interface InvestigationStatusResponse {
  investigation_id: string;
  status: string; // pending | running | completed | failed
  stage: string;  // triaging | root_cause_analysis | remediation | verification | closed | timed_out
  agent_outputs: AgentOutputSummary[];
}

export interface AnomalyEntry {
  error_type: string;
  service_name: string;
  count: number;
}

export interface ErrorGroup {
  error_type: string;
  service_name: string;
  count: number;
}

export interface FailurePattern {
  signature: string;
  count: number;
}

export interface AlertSummary {
  alert_type: "availability" | "performance" | "error_rate" | "resource" | "security" | "custom";
  severity: "critical" | "high" | "medium" | "low";
  impacted_services: string[];
  alert_timestamp: string;
  classification_status: "classified" | "unclassified" | "parse_error";
}

export interface LogSummary {
  anomalies: Record<string, AnomalyEntry>;
  error_groups: Record<string, ErrorGroup>;
  failure_patterns: FailurePattern[];
  analysis_status: "ok" | "insufficient_data";
}

export interface DocumentExcerpt {
  content: string;
  document_name: string;
  section: string;
  relevance_score: number;
}

export interface RetrievalContext {
  excerpts: DocumentExcerpt[];
  retrieval_status: "ok" | "no_relevant_context";
}

export interface RootCauseHypothesis {
  hypothesis: string;
  confidence_score: number;
  evidence: string[];
}

export interface RCAResult {
  hypotheses: RootCauseHypothesis[];
  analysis_status: "ok" | "low_confidence" | "invalid_input" | "timed_out";
}

export interface RemediationStep {
  action: string;
  category: "operational" | "configuration" | "code_change";
  rationale: string;
  confidence: "supported" | "speculative";
}

export interface RemediationList {
  steps: RemediationStep[];
}

export interface PostmortemSection {
  heading: string;
  body: string;
  source_agent: string;
}

export interface Postmortem {
  investigation_id: string;
  sections: PostmortemSection[];
  postmortem_status: "ready" | "pending" | "incomplete_inputs";
  missing_inputs: string[];
}

export interface ReportResponse {
  investigation_id: string;
  postmortem_status: string;
  sections: PostmortemSection[] | null;
}

export interface RecommendationsResponse {
  investigation_id: string;
  recommendations_status: string;
  steps: RemediationStep[] | null;
}

export interface IngestResponse {
  job_id: string;
  status: string;
}

export interface ErrorResponse {
  error_code: string;
  message: string;
  request_id: string;
}
