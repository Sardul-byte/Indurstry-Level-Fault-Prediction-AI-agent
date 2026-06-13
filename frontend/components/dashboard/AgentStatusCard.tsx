import React from "react";

interface AgentStatusCardProps {
  agentName: string;
  status: "pending" | "running" | "completed" | "failed";
  output?: any;
}

export function AgentStatusCard({ agentName, status, output }: AgentStatusCardProps) {
  // Format Agent name to readable title (e.g. alert_agent -> Alert Agent)
  const formatName = (name: string) => {
    return name
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  // Helper to serialize and format agent output into text
  const formatOutputText = (out: any): string => {
    if (!out) return "Awaiting agent execution...";
    
    // Custom formats for specific agent outputs
    if (out.alert_type) {
      return `Classified alert as [${out.alert_type}] severity [${out.severity}] affecting services: [${(out.impacted_services || []).join(", ")}]`;
    }
    if (out.analysis_status && out.anomalies) {
      const anomalyKeys = Object.keys(out.anomalies || {});
      const patternCount = (out.failure_patterns || []).length;
      return `Log status: ${out.analysis_status}. Detected ${anomalyKeys.length} anomalies and ${patternCount} failure signatures.`;
    }
    if (out.retrieval_status && out.excerpts) {
      return `Retrieved ${out.excerpts.length} reference documents from the vector store Knowledge Base.`;
    }
    if (out.hypotheses) {
      const hypotheses = (out.hypotheses || []).map((h: any) => `- ${h.hypothesis} (${Math.round(h.confidence_score * 100)}% confidence)`).join(" \n");
      return `RCA Results (${out.analysis_status}):\n${hypotheses}`;
    }
    if (out.steps) {
      const steps = (out.steps || []).map((s: any) => `- [${s.category}] ${s.action}`).join(" \n");
      return `Remediation Recommendations:\n${steps}`;
    }
    if (out.sections) {
      return `Incident Postmortem report ready (${out.sections.length} sections compiled).`;
    }

    try {
      return typeof out === "string" ? out : JSON.stringify(out);
    } catch {
      return "Successfully executed.";
    }
  };

  const getStatusStyles = (s: string) => {
    switch (s) {
      case "completed":
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      case "running":
        return "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 animate-pulse";
      case "failed":
        return "bg-red-500/10 border-red-500/30 text-red-400";
      default:
        return "bg-slate-500/5 border-slate-500/20 text-slate-500";
    }
  };

  const rawText = formatOutputText(output);
  
  // Requirement 15.1: output summary <= 500 characters, truncate cleanly
  const truncatedText = rawText.length > 500 ? rawText.substring(0, 497) + "..." : rawText;

  return (
    <div className={`p-6 border rounded-2xl bg-slate-900/60 backdrop-blur transition duration-300 hover:scale-[1.01] ${
      status === "failed" ? "border-red-500/20 hover:border-red-500/40" : "border-slate-800 hover:border-slate-700"
    }`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-200">{formatName(agentName)}</h3>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusStyles(status)}`}>
          {status}
        </span>
      </div>
      <div 
        data-testid="output-summary" 
        className="text-sm text-slate-400 font-mono whitespace-pre-line leading-relaxed bg-slate-950/65 rounded-xl p-4 border border-slate-900 overflow-hidden"
      >
        {truncatedText}
      </div>
    </div>
  );
}
