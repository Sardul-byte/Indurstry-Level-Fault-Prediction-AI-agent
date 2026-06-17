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
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
          Retrieved Runbook Evidence
        </h2>
        <div className="text-sm text-muted-foreground italic bg-surface-raised border border-border rounded-xl p-4">
          No relevant runbooks or knowledge bases matched this incident query signature.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
        Retrieved Runbook Evidence
      </h2>
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {excerpts.map((exc, index) => {
          const matchPercentage = Math.round(exc.relevance_score * 100);
          return (
            <div 
              key={index} 
              className="bg-surface border border-border rounded-xl p-4 space-y-2 hover:border-primary/40 transition duration-200"
            >
              <div className="flex justify-between items-start flex-wrap gap-2 text-xs">
                <div className="space-y-1">
                  <span className="text-primary font-bold block">
                    📄 {exc.document_name}
                  </span>
                  <span className="text-muted-foreground font-semibold">
                    Section: {exc.section}
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-primary-light border border-primary-muted text-primary font-bold font-mono">
                  {matchPercentage}% relevance
                </span>
              </div>
              <p className="text-xs font-mono text-foreground bg-surface-raised p-3 rounded-lg border border-border leading-relaxed overflow-hidden">
                {exc.content}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
