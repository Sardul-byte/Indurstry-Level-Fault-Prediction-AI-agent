import React from "react";

interface RemediationStepCardProps {
  action: string;
  category: "operational" | "configuration" | "code_change";
  rationale: string;
  confidence: "supported" | "speculative";
  priority: number;
}

export function RemediationStepCard({ action, category, rationale, confidence, priority }: RemediationStepCardProps) {
  
  // Format Category name to nice text
  const formatCategory = (cat: string) => {
    if (cat === "code_change") return "Code Change";
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "operational":
        return "bg-cyan-500/10 border-cyan-500/30 text-cyan-400";
      case "configuration":
        return "bg-purple-500/10 border-purple-500/30 text-purple-400";
      case "code_change":
        return "bg-amber-500/10 border-amber-500/30 text-amber-400";
      default:
        return "bg-slate-500/10 border-slate-500/30 text-slate-400";
    }
  };

  const getConfidenceColor = (conf: string) => {
    if (conf === "supported") {
      return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
    }
    return "bg-slate-500/10 border-slate-500/25 text-slate-500";
  };

  return (
    <div className={`p-6 border rounded-2xl bg-slate-900 shadow-xl transition hover:border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center ${
      confidence === "supported" ? "border-slate-800" : "border-slate-850/60"
    }`}>
      <div className="space-y-3 flex-1">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-6 h-6 rounded-lg bg-slate-850 border border-slate-850 text-slate-400 font-bold text-xs flex items-center justify-center">
            {priority}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getCategoryColor(category)}`}>
            {formatCategory(category)}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getConfidenceColor(confidence)}`}>
            {confidence}
          </span>
        </div>
        
        <h3 className="font-bold text-slate-200 text-sm md:text-base leading-snug">
          {action}
        </h3>
        
        <p className="text-xs text-slate-400 leading-relaxed italic">
          <span className="font-semibold text-slate-500 not-italic mr-1">Rationale:</span>
          {rationale}
        </p>
      </div>
    </div>
  );
}
