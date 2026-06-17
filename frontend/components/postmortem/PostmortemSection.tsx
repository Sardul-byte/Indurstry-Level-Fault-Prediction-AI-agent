import React from "react";
import { 
  BellRing, 
  Terminal, 
  Database, 
  BrainCircuit, 
  ShieldAlert, 
  FileText,
  UserCheck
} from "lucide-react";

interface PostmortemSectionProps {
  heading: string;
  body: string;
  sourceAgent: string;
}

const AGENT_META: Record<string, { title: string; icon: any; color: string }> = {
  alert_agent: {
    title: "Alert Classifier",
    icon: BellRing,
    color: "text-primary border-primary-muted bg-primary-light"
  },
  log_analysis_agent: {
    title: "Log Analyzer",
    icon: Terminal,
    color: "text-primary border-primary-muted bg-primary-light"
  },
  retrieval_agent: {
    title: "RAG Evidence Finder",
    icon: Database,
    color: "text-primary border-primary-muted bg-primary-light"
  },
  rca_agent: {
    title: "Root Cause Engine",
    icon: BrainCircuit,
    color: "text-purple-700 border-purple-300 bg-purple-50"
  },
  remediation_agent: {
    title: "Remediation Orchestrator",
    icon: ShieldAlert,
    color: "text-purple-700 border-purple-300 bg-purple-50"
  },
  postmortem_agent: {
    title: "Postmortem Writer",
    icon: FileText,
    color: "text-success border-success/35 bg-success/10"
  },
};

export function PostmortemSection({ heading, body, sourceAgent }: PostmortemSectionProps) {
  const meta = AGENT_META[sourceAgent] || {
    title: sourceAgent
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    icon: UserCheck,
    color: "text-muted-foreground border-border bg-surface-raised"
  };

  const IconComponent = meta.icon;

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4 hover:border-border-soft transition duration-300">
      {/* 2.3: Visually distinct heading (h2) and body text (Requirement 17.1) */}
      <div className="flex justify-between items-center border-b border-border pb-3 flex-wrap gap-3">
        <h2 className="text-base md:text-lg font-bold text-foreground font-mono tracking-tight">
          {heading}
        </h2>
        <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold font-mono flex items-center gap-1.5 ${meta.color}`}>
          <IconComponent className="w-3.5 h-3.5" />
          Attributed: {meta.title}
        </span>
      </div>
      
      <p className="text-xs text-foreground leading-relaxed font-mono whitespace-pre-wrap bg-surface-raised p-4.5 rounded-xl border border-border">
        {body}
      </p>
    </div>
  );
}
