import React from "react";
import { EvidenceList } from "./EvidenceList";

interface HypothesisCardProps {
  hypothesis: string;
  confidenceScore: number;
  evidence: string[];
  rank: number;
}

export function HypothesisCard({ hypothesis, confidenceScore, evidence, rank }: HypothesisCardProps) {
  const percentage = Math.round(confidenceScore * 100);
  
  // Choose badge color based on confidence level
  const getBadgeColor = (score: number) => {
    if (score >= 0.7) return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
    if (score >= 0.4) return "bg-blue-500/10 border-blue-500/30 text-blue-400";
    return "bg-amber-500/10 border-amber-500/30 text-amber-400";
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl transition hover:border-slate-700 space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-lg bg-slate-850 flex items-center justify-center font-bold text-xs text-slate-400 border border-slate-800">
            #{rank}
          </span>
          <h3 className="font-bold text-slate-200 text-sm md:text-base leading-snug">
            {hypothesis}
          </h3>
        </div>
        
        {/* Render confidence score formatted (2 decimal places) for Requirement 16.1 */}
        <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${getBadgeColor(confidenceScore)}`}>
          {confidenceScore.toFixed(2)} Confidence ({percentage}%)
        </span>
      </div>
      
      <div className="border-t border-slate-800 pt-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Supporting Evidence
        </h4>
        <EvidenceList evidence={evidence} />
      </div>
    </div>
  );
}
