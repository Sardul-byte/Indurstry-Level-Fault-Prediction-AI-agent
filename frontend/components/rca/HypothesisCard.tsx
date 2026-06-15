import React, { useState } from "react";
import { EvidenceList } from "./EvidenceList";
import { ChevronDown, ChevronUp, BrainCircuit, Activity } from "lucide-react";

interface HypothesisCardProps {
  hypothesis: string;
  confidenceScore: number;
  evidence: string[];
  rank: number;
}

export function HypothesisCard({ hypothesis, confidenceScore, evidence, rank }: HypothesisCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const percentage = Math.round(confidenceScore * 100);
  
  // Choose badge and bar colors based on confidence level
  const getColors = (score: number) => {
    if (score >= 0.7) {
      return {
        badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
        bar: "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]",
        glow: "hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.05)]",
      };
    }
    if (score >= 0.4) {
      return {
        badge: "bg-blue-500/10 border-blue-500/30 text-blue-400",
        bar: "bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]",
        glow: "hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.05)]",
      };
    }
    return {
      badge: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      bar: "bg-gradient-to-r from-amber-500 to-orange-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]",
      glow: "hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.05)]",
    };
  };

  const colors = getColors(confidenceScore);

  return (
    <div className={`glass-panel p-6 shadow-xl transition-all duration-350 rounded-2xl border border-slate-800/80 ${colors.glow} space-y-4`}>
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div className="flex items-start gap-4 flex-1">
          <span className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center font-mono font-bold text-xs text-slate-400 border border-slate-850 shrink-0">
            #{rank}
          </span>
          <div className="space-y-2 flex-1">
            <h3 className="font-bold text-slate-200 text-sm md:text-base leading-relaxed flex items-center gap-2">
              <BrainCircuit className="w-4.5 h-4.5 text-cyan-400 shrink-0" />
              {hypothesis}
            </h3>
            
            {/* Custom Interactive Confidence Progress Bar */}
            <div className="space-y-1.5 pt-1 max-w-md">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">
                <span>Confidence Score</span>
                <span className="text-slate-400 font-bold">{percentage}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850/80">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${colors.bar}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5">
          {/* Render confidence score formatted (2 decimal places) for Requirement 16.1 */}
          <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${colors.badge}`}>
            {confidenceScore.toFixed(2)} Score
          </span>
          
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="w-8 h-8 rounded-lg bg-slate-900/60 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition flex items-center justify-center shrink-0"
            title={isOpen ? "Collapse evidence" : "Expand evidence"}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {isOpen && (
        <div className="border-t border-slate-850/60 pt-4 animate-fade-in">
          <div className="flex items-center gap-1.5 mb-3">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
              Supporting Evidence
            </h4>
          </div>
          <EvidenceList evidence={evidence} />
        </div>
      )}
    </div>
  );
}
