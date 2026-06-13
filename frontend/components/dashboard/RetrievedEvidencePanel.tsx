import React from "react";
import { RetrievalContext } from "../../types/api";

interface RetrievedEvidencePanelProps {
  retrievalContext?: RetrievalContext;
}

export function RetrievedEvidencePanel({ retrievalContext }: RetrievedEvidencePanelProps) {
  if (!retrievalContext) return null;

  const { excerpts, retrieval_status } = retrievalContext;

  if (retrieval_status === "no_relevant_context" || !excerpts || excerpts.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Retrieved Runbook Evidence
        </h2>
        <div className="text-sm text-slate-500 italic bg-slate-950/40 border border-slate-900/50 rounded-xl p-4">
          No relevant runbooks or knowledge bases matched this incident query signature.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
        Retrieved Runbook Evidence
      </h2>
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {excerpts.map((exc, index) => {
          const matchPercentage = Math.round(exc.relevance_score * 100);
          return (
            <div 
              key={index} 
              className="bg-slate-950/80 border border-slate-850 rounded-xl p-4 space-y-2 hover:border-slate-700 transition duration-200"
            >
              <div className="flex justify-between items-start flex-wrap gap-2 text-xs">
                <div className="space-y-1">
                  <span className="text-cyan-400 font-bold block">
                    📄 {exc.document_name}
                  </span>
                  <span className="text-slate-500 font-semibold">
                    Section: {exc.section}
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold font-mono">
                  {matchPercentage}% relevance
                </span>
              </div>
              <p className="text-xs font-mono text-slate-300 bg-slate-900/40 p-3 rounded-lg border border-slate-900 leading-relaxed overflow-hidden">
                {exc.content}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
