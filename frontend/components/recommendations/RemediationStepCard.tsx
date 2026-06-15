import React, { useState } from "react";
import { Wrench, Sliders, GitBranch, Cpu, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";

interface RemediationStepCardProps {
  action: string;
  category: "operational" | "configuration" | "code_change";
  rationale: string;
  confidence: "supported" | "speculative";
  priority: number;
}

export function RemediationStepCard({ action, category, rationale, confidence, priority }: RemediationStepCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  
  // Format Category name to nice text
  const formatCategory = (cat: string) => {
    if (cat === "code_change") return "Code Change";
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  const getCategoryDetails = (cat: string) => {
    switch (cat) {
      case "operational":
        return {
          badge: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
          icon: Cpu,
          glow: "hover:border-cyan-500/20 hover:shadow-[0_0_15px_rgba(6,182,212,0.05)]",
        };
      case "configuration":
        return {
          badge: "bg-purple-500/10 border-purple-500/30 text-purple-400",
          icon: Sliders,
          glow: "hover:border-purple-500/20 hover:shadow-[0_0_15px_rgba(168,85,247,0.05)]",
        };
      case "code_change":
        return {
          badge: "bg-amber-500/10 border-amber-500/30 text-amber-400",
          icon: GitBranch,
          glow: "hover:border-amber-500/20 hover:shadow-[0_0_15px_rgba(245,158,11,0.05)]",
        };
      default:
        return {
          badge: "bg-slate-500/10 border-slate-500/30 text-slate-400",
          icon: Wrench,
          glow: "hover:border-slate-800",
        };
    }
  };

  const getConfidenceColor = (conf: string) => {
    if (conf === "supported") {
      return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
    }
    return "bg-slate-500/10 border-slate-500/25 text-slate-400";
  };

  const details = getCategoryDetails(category);
  const IconComponent = details.icon;

  return (
    <div className={`p-6 border rounded-2xl bg-slate-900/60 shadow-xl transition-all duration-350 flex flex-col gap-4 ${details.glow} ${
      confidence === "supported" ? "border-slate-800/80" : "border-slate-850/60"
    }`}>
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div className="flex items-start gap-4 flex-1">
          <span className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-850 text-slate-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
            {priority}
          </span>
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider font-mono flex items-center gap-1.5 ${details.badge}`}>
                <IconComponent className="w-3 h-3" />
                {formatCategory(category)}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider font-mono ${getConfidenceColor(confidence)}`}>
                {confidence}
              </span>
            </div>
            
            <h3 className="font-bold text-slate-200 text-sm md:text-base leading-relaxed">
              {action}
            </h3>
          </div>
        </div>

        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition flex items-center justify-center shrink-0"
        >
          {isOpen ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-slate-850/60 pt-4 animate-fade-in">
          <div className="flex items-start gap-2.5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-950">
            <CheckCircle className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-450 leading-relaxed italic">
              <span className="font-bold text-slate-350 not-italic uppercase tracking-widest text-[9px] font-mono mr-1.5">Rationale:</span>
              {rationale}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
