import React from "react";
import { 
  FileSearch, 
  Binary, 
  Wrench, 
  ShieldCheck, 
  Archive,
  AlertTriangle 
} from "lucide-react";

interface WorkflowStageBarProps {
  currentStage: string; // triaging | root_cause_analysis | remediation | verification | closed | timed_out
}

const STAGES = [
  { id: "triaging", label: "Triage & Logs", icon: FileSearch },
  { id: "root_cause_analysis", label: "Root Cause (RCA)", icon: Binary },
  { id: "remediation", label: "Remediation", icon: Wrench },
  { id: "verification", label: "Verification", icon: ShieldCheck },
  { id: "closed", label: "Closed & Saved", icon: Archive },
];

export function WorkflowStageBar({ currentStage }: WorkflowStageBarProps) {
  const activeIndex = STAGES.findIndex((s) => s.id === currentStage);
  const isTimedOut = currentStage === "timed_out";

  return (
    <div className="w-full glass-panel rounded-2xl p-6 md:p-8 mb-8 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
          Investigation Progress Pipeline
        </h2>
        {isTimedOut ? (
          <span className="px-3 py-1 rounded-full bg-red-950/40 border border-red-900/50 text-red-400 text-xs font-bold animate-pulse flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Pipeline Blocked
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-900/50 text-cyan-400 text-xs font-bold font-mono">
            Stage: {activeIndex >= 0 ? `${Math.round(((activeIndex + 1) / STAGES.length) * 100)}%` : "0%"}
          </span>
        )}
      </div>

      {/* Progress Bar Line */}
      <div className="relative flex justify-between items-center px-4 md:px-10">
        <div className="absolute left-4 right-4 md:left-10 md:right-10 top-1/2 h-0.5 bg-slate-900 -translate-y-1/2 -z-10" />
        
        {/* Dynamic progress bar fill */}
        <div 
          className={`absolute left-4 md:left-10 top-1/2 h-0.5 transition-all duration-1000 -translate-y-1/2 -z-10 ${
            isTimedOut ? "bg-red-500" : "bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"
          }`}
          style={{
            width: activeIndex >= 0 
              ? `calc(${(activeIndex / (STAGES.length - 1)) * 100}% - ${activeIndex === 0 ? "0px" : "10px"})` 
              : "0%",
          }}
        />

        {/* Steps dots */}
        {STAGES.map((stage, index) => {
          const IconComponent = stage.icon;
          const isCompleted = activeIndex > index;
          const isActive = activeIndex === index;
          
          let dotStyles = "border-slate-800 bg-slate-950 text-slate-600";
          if (isCompleted) {
            dotStyles = "border-cyan-500/80 bg-cyan-950/60 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]";
          } else if (isActive) {
            dotStyles = isTimedOut 
              ? "border-red-500 bg-red-950/80 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)] ring-4 ring-red-500/10"
              : "border-blue-500 bg-blue-950/80 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-4 ring-blue-500/10 animate-pulse";
          }

          return (
            <div key={stage.id} className="flex flex-col items-center relative z-10">
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center font-bold transition duration-500 ${dotStyles}`}>
                <IconComponent className="w-5 h-5" />
              </div>
              <span className={`absolute top-14 text-[10px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap text-center transition duration-350 ${
                isActive ? "text-cyan-400" : isCompleted ? "text-slate-300" : "text-slate-600"
              }`}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
      
      {isTimedOut && (
        <div className="mt-16 p-4 bg-red-950/20 border border-red-900/40 text-red-400 text-xs font-mono rounded-xl text-center leading-relaxed">
          Incident Response pipeline was terminated during Root Cause Analysis node execution due to system timeout settings.
        </div>
      )}
      
      {/* Spacer for step text labels */}
      <div className="h-10" />
    </div>
  );
}
