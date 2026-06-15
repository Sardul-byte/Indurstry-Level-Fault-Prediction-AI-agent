import React from "react";
import { 
  BellRing, 
  Terminal, 
  Database, 
  BrainCircuit, 
  ShieldAlert, 
  FileText,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle
} from "lucide-react";

interface AgentStatusCardProps {
  agentName: string;
  status: "pending" | "running" | "completed" | "failed";
  output?: any;
}

const AGENT_META: Record<string, { title: string; desc: string; icon: any; glowClass: string }> = {
  alert_agent: {
    title: "Alert Classifier",
    desc: "Ingests alerts and gauges blast radius",
    icon: BellRing,
    glowClass: "glow-card-cyan",
  },
  log_analysis_agent: {
    title: "Log Analyzer",
    desc: "Searches for failure log signatures",
    icon: Terminal,
    glowClass: "glow-card-cyan",
  },
  retrieval_agent: {
    title: "RAG Evidence Finder",
    desc: "Retrieves matches from knowledge base",
    icon: Database,
    glowClass: "glow-card-cyan",
  },
  rca_agent: {
    title: "Root Cause Engine",
    desc: "Brainstorms failure hypotheses",
    icon: BrainCircuit,
    glowClass: "glow-card-purple",
  },
  remediation_agent: {
    title: "Remediation Orchestrator",
    desc: "Compiles action plan recommendations",
    icon: ShieldAlert,
    glowClass: "glow-card-purple",
  },
  postmortem_agent: {
    title: "Postmortem Writer",
    desc: "Drafts comprehensive incident report",
    icon: FileText,
    glowClass: "glow-card-emerald",
  },
};

export function AgentStatusCard({ agentName, status, output }: AgentStatusCardProps) {
  const meta = AGENT_META[agentName] || {
    title: agentName,
    desc: "Pipeline agent execution block",
    icon: Terminal,
    glowClass: "glow-card-cyan",
  };

  const IconComponent = meta.icon;

  const formatOutputText = (out: any): string => {
    if (!out) {
      if (status === "running") return "Retrieving context & running LLM inference...";
      if (status === "failed") return "Agent failed during execution node.";
      return "Awaiting upstream stage completion...";
    }
    
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

  const getStatusIndicator = (s: string) => {
    switch (s) {
      case "completed":
        return {
          icon: CheckCircle2,
          text: "completed",
          badgeClass: "bg-emerald-950/40 border-emerald-900/50 text-emerald-400",
        };
      case "running":
        return {
          icon: Loader2,
          text: "running",
          badgeClass: "bg-cyan-950/40 border-cyan-900/50 text-cyan-400 animate-pulse",
        };
      case "failed":
        return {
          icon: XCircle,
          text: "failed",
          badgeClass: "bg-red-950/40 border-red-900/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]",
        };
      default:
        return {
          icon: Clock,
          text: "pending",
          badgeClass: "bg-slate-900/40 border-slate-800/80 text-slate-500",
        };
    }
  };

  const indicator = getStatusIndicator(status);
  const StatusIcon = indicator.icon;
  const rawText = formatOutputText(output);
  const truncatedText = rawText.length > 500 ? rawText.substring(0, 497) + "..." : rawText;

  // Assign card-glow based on status
  let glowClass = "border-slate-800 bg-slate-900/50 hover:border-slate-700";
  if (status === "failed") {
    glowClass = "border-red-900/40 bg-slate-900/50 glow-card-ruby";
  } else if (status === "running") {
    glowClass = "border-cyan-900/40 bg-slate-900/60 shadow-[0_0_15px_rgba(6,182,212,0.05)]";
  } else if (status === "completed") {
    glowClass = `border-slate-850 bg-slate-900/50 ${meta.glowClass}`;
  }

  return (
    <div className={`p-6 border rounded-2xl backdrop-blur transition duration-300 ${glowClass}`}>
      <div className="flex justify-between items-start gap-4 mb-4">
        <div className="flex gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
            status === "completed" ? "bg-cyan-950/20 border-cyan-900/30 text-cyan-400" : "bg-slate-950/80 border-slate-800 text-slate-500"
          }`}>
            <IconComponent className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-200 text-sm">{meta.title}</h3>
            <p className="text-[10px] text-slate-500 font-semibold">{meta.desc}</p>
          </div>
        </div>

        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border flex items-center gap-1 shrink-0 ${indicator.badgeClass}`}>
          <StatusIcon className={`w-3 h-3 ${status === "running" ? "animate-spin" : ""}`} />
          {indicator.text}
        </span>
      </div>

      <div 
        data-testid="output-summary" 
        className="text-xs text-slate-400 font-mono whitespace-pre-line leading-relaxed bg-slate-950/80 rounded-xl p-4 border border-slate-950 overflow-hidden min-h-[90px]"
      >
        {truncatedText}
      </div>
    </div>
  );
}
