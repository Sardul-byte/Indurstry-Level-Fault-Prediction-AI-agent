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
        badge: "bg-success/10 border-success/35 text-success",
        bar: "bg-success",
        glow: "hover:border-success/30 hover:shadow-sm",
      };
    }
    if (score >= 0.4) {
      return {
        badge: "bg-blue-500/10 border-blue-500/35 text-blue-650",
        bar: "bg-blue-600",
        glow: "hover:border-blue-500/30 hover:shadow-sm",
      };
    }
    return {
      badge: "bg-warning/10 border-warning/35 text-warning",
      bar: "bg-warning",
      glow: "hover:border-warning/30 hover:shadow-sm",
    };
  };

  const colors = getColors(confidenceScore);

  return (
    <div className={`bg-surface border border-border p-6 shadow-sm transition-all duration-350 rounded-2xl ${colors.glow} space-y-4`}>
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div className="flex items-start gap-4 flex-1">
          <span className="w-8 h-8 rounded-xl bg-surface-raised border border-border flex items-center justify-center font-mono font-bold text-xs text-muted-foreground shrink-0">
            #{rank}
          </span>
          <div className="space-y-2 flex-1">
            <h3 className="font-bold text-foreground text-sm md:text-base leading-relaxed flex items-center gap-2">
              <BrainCircuit className="w-4.5 h-4.5 text-primary shrink-0" />
              {hypothesis}
            </h3>
            
            {/* Custom Interactive Confidence Progress Bar */}
            <div className="space-y-1.5 pt-1 max-w-md">
              <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground font-bold uppercase tracking-wider">
                <span>Confidence Score</span>
                <span className="text-foreground font-bold">{percentage}%</span>
              </div>
              <div className="w-full bg-surface-raised h-2 rounded-full overflow-hidden border border-border">
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
            className="w-8 h-8 rounded-lg bg-surface border border-border hover:border-border-soft text-muted-foreground hover:text-foreground transition flex items-center justify-center shrink-0"
            title={isOpen ? "Collapse evidence" : "Expand evidence"}
          >
            {isOpen ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
          </button>
        </div>
      </div>
      
      {isOpen && (
        <div className="border-t border-border pt-4 animate-fade-in">
          <div className="flex items-center gap-1.5 mb-3">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
              Supporting Evidence
            </h4>
          </div>
          <EvidenceList evidence={evidence} />
        </div>
      )}
    </div>
  );
}
