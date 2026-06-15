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
    color: "text-cyan-400 border-cyan-500/20 bg-cyan-950/20"
  },
  log_analysis_agent: {
    title: "Log Analyzer",
    icon: Terminal,
    color: "text-cyan-400 border-cyan-500/20 bg-cyan-950/20"
  },
  retrieval_agent: {
    title: "RAG Evidence Finder",
    icon: Database,
    color: "text-cyan-400 border-cyan-500/20 bg-cyan-950/20"
  },
  rca_agent: {
    title: "Root Cause Engine",
    icon: BrainCircuit,
    color: "text-purple-400 border-purple-500/20 bg-purple-950/20"
  },
  remediation_agent: {
    title: "Remediation Orchestrator",
    icon: ShieldAlert,
    color: "text-purple-400 border-purple-500/20 bg-purple-950/20"
  },
  postmortem_agent: {
    title: "Postmortem Writer",
    icon: FileText,
    color: "text-emerald-400 border-emerald-500/20 bg-emerald-950/20"
  },
};

export function PostmortemSection({ heading, body, sourceAgent }: PostmortemSectionProps) {
  const meta = AGENT_META[sourceAgent] || {
    title: sourceAgent
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    icon: UserCheck,
    color: "text-slate-400 border-slate-800 bg-slate-900/60"
  };

  const IconComponent = meta.icon;

  return (
    <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-6 shadow-xl space-y-4 hover:border-slate-800 transition duration-300">
      {/* 2.3: Visually distinct heading (h2) and body text (Requirement 17.1) */}
      <div className="flex justify-between items-center border-b border-slate-850/60 pb-3 flex-wrap gap-3">
        <h2 className="text-base md:text-lg font-bold text-slate-100 font-mono tracking-tight">
          {heading}
        </h2>
        <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold font-mono flex items-center gap-1.5 ${meta.color}`}>
          <IconComponent className="w-3.5 h-3.5" />
          Attributed: {meta.title}
        </span>
      </div>
      
      <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap bg-slate-950/60 p-4.5 rounded-xl border border-slate-950">
        {body}
      </p>
    </div>
  );
}
