"use client";

import React from "react";
import Link from "next/link";
import { getRecommendations, getInvestigation } from "../../../../lib/api";
import { usePolling } from "../../../../lib/polling";
import { RemediationStepCard } from "../../../../components/recommendations/RemediationStepCard";
import { 
  LayoutDashboard, 
  Lightbulb, 
  CheckSquare, 
  FileText, 
  Activity, 
  Cpu, 
  GitBranch, 
  Sliders, 
  AlertTriangle,
  Fingerprint
} from "lucide-react";

interface PageProps {
  params: { id: string };
}

export default function RecommendationsPage({ params }: PageProps) {
  const id = params.id;

  // Poll investigation status to check completion state
  const { data: invData } = usePolling(
    () => getInvestigation(id),
    5000,
    (d) => d.status === "completed" || d.status === "failed"
  );

  // Poll recommendations list from the dedicated recommendations endpoint (Requirement 9.1)
  const { data: recData, isStale, error } = usePolling(
    () => getRecommendations(id),
    5000,
    (d) => d.recommendations_status === "completed" || d.recommendations_status === "failed"
  );

  const status = invData?.status || "pending";
  const recStatus = recData?.recommendations_status || "pending";

  // 1. If investigation is failed, show error block (Requirement 9.4 / 16.4)
  if (status === "failed" || recStatus === "failed") {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,#ef444405,#000_100%)] -z-10" />
        <div className="max-w-md w-full bg-red-950/10 border border-red-900/40 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-950/20 border border-red-900/30 flex items-center justify-center mx-auto text-red-400 text-2xl shadow-inner">
            ⚠️
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-red-400 uppercase tracking-wider font-mono">Recommendations Blocked</h1>
            <p className="text-slate-400 text-xs leading-relaxed font-mono">
              Remediation steps are unavailable because the investigation failed or could not analyze logs.
            </p>
          </div>
          <Link href={`/investigation/${id}`} className="inline-block w-full py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 text-xs font-bold transition">
            View Live Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // 2. Disable navigation if not completed (Requirement 16.4)
  if (status !== "completed") {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,#0c4a6e10,#000_100%)] -z-10" />
        <div className="max-w-md w-full glass-panel border border-slate-800/80 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-2xl shadow-inner">
            🔒
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-slate-200 uppercase tracking-wider font-mono">Recommendations Locked</h1>
            <p className="text-slate-400 text-xs leading-relaxed font-mono">
              Recommendations are locked until the investigation completes.
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850/80 text-[11px] font-mono text-slate-500">
            Current status: <span className="font-semibold text-cyan-400">{status}</span>
          </div>
          <Link href={`/investigation/${id}`} className="inline-block w-full py-2.5 px-5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition shadow-lg">
            View Live Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // 3. Handle pending loading state (Requirement 9.2)
  if (recStatus === "pending" || !recData) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_0%,#0c4a6e15,#000_100%)] -z-10" />
        <div className="flex flex-col items-center space-y-4 font-mono text-xs text-slate-400">
          <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <span className="font-bold uppercase tracking-widest text-[10px]">Formulating recommendations...</span>
        </div>
      </main>
    );
  }

  const steps = recData.steps || [];

  // Count steps by category
  const operationalCount = steps.filter((s: any) => s.category === "operational").length;
  const configCount = steps.filter((s: any) => s.category === "configuration").length;
  const codeCount = steps.filter((s: any) => s.category === "code_change").length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_0%,#0c4a6e15,#000_100%)] -z-10" />

      {isStale && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-[10px] py-2 px-4 text-center font-bold tracking-wider font-mono sticky top-0 z-50 backdrop-blur uppercase flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(245,158,11,0.15)]">
          <AlertTriangle className="w-3.5 h-3.5 animate-pulse" /> Connection lost. Serving cached recommendations.
        </div>
      )}

      {/* Header section */}
      <header className="border-b border-slate-900/80 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_#06b6d4]" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                Remediation Actions
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-extrabold text-slate-100 font-mono tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Action Plan Recommendations
            </h1>
          </div>

          <nav className="flex gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
            <Link 
              href={`/investigation/${id}`}
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-lg text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5 font-mono uppercase tracking-wider"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </Link>
            <Link 
              href={`/investigation/${id}/root-cause`}
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-lg text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5 font-mono uppercase tracking-wider"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              RCA Results
            </Link>
            <Link 
              href={`/investigation/${id}/recommendations`}
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-lg bg-cyan-950/40 border border-cyan-900/30 text-cyan-400 flex items-center gap-1.5 font-mono uppercase tracking-wider"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Recommendations
            </Link>
            <Link 
              href={`/investigation/${id}/postmortem`}
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-lg text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5 font-mono uppercase tracking-wider"
            >
              <FileText className="w-3.5 h-3.5" />
              Postmortem
            </Link>
          </nav>
        </div>
      </header>

      {/* Main container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        
        {/* KPI stats section */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-850 text-cyan-400 shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-500 uppercase font-mono tracking-wider">Total Steps</div>
              <div className="text-lg font-bold text-slate-200 font-mono mt-0.5">{steps.length}</div>
            </div>
          </div>
          
          <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-850 text-cyan-500 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-500 uppercase font-mono tracking-wider">Operational</div>
              <div className="text-lg font-bold text-cyan-400 font-mono mt-0.5">{operationalCount}</div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-850 text-purple-400 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-500 uppercase font-mono tracking-wider">Config Patches</div>
              <div className="text-lg font-bold text-purple-400 font-mono mt-0.5">{configCount}</div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-850 text-amber-400 shrink-0">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-500 uppercase font-mono tracking-wider">Code Change</div>
              <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">{codeCount}</div>
            </div>
          </div>
        </div>

        {/* Helper guide */}
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 text-[11px] font-mono text-slate-450 rounded-xl leading-relaxed">
          Recommendations are prioritized based on the **confidence of the matching root cause hypothesis**, and categorized in order: **Operational** (restarts, scale ups), **Configuration** (env patches), and **Code Changes** (software updates).
        </div>

        {/* Steps List (Requirement 16.5 empty state check) */}
        {steps.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 shadow-xl font-mono text-xs">
            No remediation recommendations were generated for this incident.
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {steps.map((step: any, index: number) => (
              <RemediationStepCard
                key={index}
                priority={index + 1}
                action={step.action}
                category={step.category}
                rationale={step.rationale}
                confidence={step.confidence}
              />
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
