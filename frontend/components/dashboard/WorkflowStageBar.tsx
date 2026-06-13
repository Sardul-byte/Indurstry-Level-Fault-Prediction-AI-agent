import React from "react";

interface WorkflowStageBarProps {
  currentStage: string; // triaging | root_cause_analysis | remediation | verification | closed | timed_out
}

const STAGES = [
  { id: "triaging", label: "Triage Alert & Logs" },
  { id: "root_cause_analysis", label: "Root Cause Analysis" },
  { id: "remediation", label: "Formulate Remediation" },
  { id: "verification", label: "Verification" },
  { id: "closed", label: "Closed & Saved" },
];

export function WorkflowStageBar({ currentStage }: WorkflowStageBarProps) {
  // Find index of the current stage
  const activeIndex = STAGES.findIndex((s) => s.id === currentStage);
  
  // Custom check for timed_out/failed
  const isTimedOut = currentStage === "timed_out";

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6">
        Investigation Progress Pipeline
      </h2>

      {/* Progress Bar Line */}
      <div className="relative flex justify-between items-center">
        <div className="absolute left-0 right-0 top-1/2 h-1 bg-slate-800 -translate-y-1/2 -z-10" />
        
        {/* Dynamic progress bar fill */}
        <div 
          className={`absolute left-0 top-1/2 h-1 transition-all duration-500 -translate-y-1/2 -z-10 ${
            isTimedOut ? "bg-red-500" : "bg-gradient-to-r from-cyan-500 to-blue-500"
          }`}
          style={{
            width: activeIndex >= 0 ? `${(activeIndex / (STAGES.length - 1)) * 100}%` : "0%",
          }}
        />

        {/* Steps dots */}
        {STAGES.map((stage, index) => {
          const isCompleted = activeIndex > index;
          const isActive = activeIndex === index;
          
          let dotStyles = "border-slate-800 bg-slate-950 text-slate-500";
          if (isCompleted) {
            dotStyles = "border-cyan-500 bg-cyan-950 text-cyan-400";
          } else if (isActive) {
            dotStyles = isTimedOut 
              ? "border-red-500 bg-red-950 text-red-400 ring-4 ring-red-500/20"
              : "border-blue-500 bg-blue-950 text-blue-400 ring-4 ring-blue-500/20";
          }

          return (
            <div key={stage.id} className="flex flex-col items-center relative z-10">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm transition duration-500 ${dotStyles}`}>
                {isCompleted ? "✓" : index + 1}
              </div>
              <span className={`absolute top-10 text-xs font-semibold whitespace-nowrap text-center transition ${
                isActive ? "text-cyan-400" : isCompleted ? "text-slate-300" : "text-slate-500"
              }`}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
      
      {isTimedOut && (
        <div className="mt-12 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold rounded-xl text-center">
          Investigation timed out during Root Cause Analysis. Execution stopped.
        </div>
      )}
      
      {/* Spacer for step text labels */}
      <div className="h-6" />
    </div>
  );
}
