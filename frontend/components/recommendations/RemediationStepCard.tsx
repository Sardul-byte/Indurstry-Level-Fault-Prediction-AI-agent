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
          badge: "bg-primary-light border-primary-muted text-primary",
          icon: Cpu,
          glow: "hover:border-primary/30 hover:shadow-sm",
        };
      case "configuration":
        return {
          badge: "bg-purple-500/10 border-purple-500/35 text-purple-700",
          icon: Sliders,
          glow: "hover:border-purple-500/30 hover:shadow-sm",
        };
      case "code_change":
        return {
          badge: "bg-warning/10 border-warning/35 text-warning",
          icon: GitBranch,
          glow: "hover:border-warning/30 hover:shadow-sm",
        };
      default:
        return {
          badge: "bg-surface-raised border border-border text-muted-foreground",
          icon: Wrench,
          glow: "hover:border-border-soft",
        };
    }
  };

  const getConfidenceColor = (conf: string) => {
    if (conf === "supported") {
      return "bg-success/10 border-success/35 text-success";
    }
    return "bg-surface-raised border border-border text-muted-foreground";
  };

  const details = getCategoryDetails(category);
  const IconComponent = details.icon;

  return (
    <div className={`p-6 border rounded-2xl bg-surface shadow-sm transition-all duration-350 flex flex-col gap-4 ${details.glow} ${
      confidence === "supported" ? "border-border" : "border-border/60"
    }`}>
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div className="flex items-start gap-4 flex-1">
          <span className="w-8 h-8 rounded-xl bg-surface-raised border border-border text-muted-foreground font-mono font-bold text-xs flex items-center justify-center shrink-0">
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
            
            <h3 className="font-bold text-foreground text-sm md:text-base leading-relaxed">
              {action}
            </h3>
          </div>
        </div>

        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-8 h-8 rounded-lg bg-surface border border-border hover:border-border-soft text-muted-foreground hover:text-foreground transition flex items-center justify-center shrink-0"
        >
          {isOpen ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-border pt-4 animate-fade-in">
          <div className="flex items-start gap-2.5 bg-surface-raised p-3.5 rounded-xl border border-border">
            <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-foreground leading-relaxed italic">
              <span className="font-bold text-muted-foreground not-italic uppercase tracking-widest text-[9px] font-mono mr-1.5">Rationale:</span>
              {rationale}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
