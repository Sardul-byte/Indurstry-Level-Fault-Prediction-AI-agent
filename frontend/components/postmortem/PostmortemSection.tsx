import React from "react";

interface PostmortemSectionProps {
  heading: string;
  body: string;
  sourceAgent: string;
}

export function PostmortemSection({ heading, body, sourceAgent }: PostmortemSectionProps) {
  // Format source agent name nicely (e.g., remediation_agent -> Remediation Agent)
  const formatAgentName = (name: string) => {
    return name
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      {/* 2.3: Visually distinct heading (h2) and body text (Requirement 17.1) */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-3 flex-wrap gap-2">
        <h2 className="text-lg md:text-xl font-bold text-slate-100">
          {heading}
        </h2>
        <span className="px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-850 text-slate-500 font-bold text-xs font-mono">
          Attribution: {formatAgentName(sourceAgent)}
        </span>
      </div>
      
      <p className="text-sm text-slate-300 leading-relaxed font-mono whitespace-pre-wrap bg-slate-950/45 p-4 rounded-xl border border-slate-950/80">
        {body}
      </p>
    </div>
  );
}
