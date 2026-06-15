"use client";

import React from "react";
import Link from "next/link";
import { getInvestigation } from "../../../../lib/api";
import { usePolling } from "../../../../lib/polling";
import { HypothesisCard } from "../../../../components/rca/HypothesisCard";
import { 
  LayoutDashboard, 
  Lightbulb, 
  CheckSquare, 
  FileText, 
  ShieldAlert, 
  TrendingUp,
  Fingerprint
} from "lucide-react";

interface PageProps {
  params: { id: string };
}

export default function RootCausePage({ params }: PageProps) {
  const id = params.id;

  const { data, error } = usePolling(
    () => getInvestigation(id),
    5000,
    (d) => d.status === "completed" || d.status === "failed"
  );

  const status = data?.status || "pending";

  // If not completed yet, disable access (Requirement 16.4)
  if (status !== "completed") {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,#0c4a6e10,#000_100%)] -z-10" />
        <div className="max-w-md w-full glass-panel border border-slate-800/80 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-2xl shadow-inner">
            🔒
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-slate-200 uppercase tracking-wider font-mono">Analysis Locked</h1>
            <p className="text-slate-400 text-xs leading-relaxed font-mono">
              The Root Cause Analysis report is generated once the incident pipeline reaches completion.
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

  // Extract RCA Agent output
  const rcaOutput = data?.agent_outputs?.find((o) => o.agent_name === "rca_agent")?.output;
  const hypotheses = rcaOutput?.hypotheses || [];
  const analysisStatus = rcaOutput?.analysis_status || "ok";

  // Compute metrics
  const totalHypotheses = hypotheses.length;
  const maxConfidence = hypotheses.length > 0 
    ? Math.max(...hypotheses.map((h: any) => h.confidence_score)) 
    : 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_0%,#0c4a6e15,#000_100%)] -z-10" />

      {/* Header section */}
      <header className="border-b border-slate-900/80 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                RCA Node Complete
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-extrabold text-slate-100 font-mono tracking-tight flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-cyan-400" />
              Root Cause Hypotheses
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
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-lg bg-cyan-950/40 border border-cyan-900/30 text-cyan-400 flex items-center gap-1.5 font-mono uppercase tracking-wider"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              RCA Results
            </Link>
            <Link 
              href={`/investigation/${id}/recommendations`}
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-lg text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5 font-mono uppercase tracking-wider"
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
        
        {/* RCA Metrics Summary Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-850 text-cyan-400">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase font-mono">Total Hypotheses</div>
              <div className="text-xl font-bold text-slate-200 font-mono mt-0.5">{totalHypotheses}</div>
            </div>
          </div>
          
          <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-850 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase font-mono">Max Confidence</div>
              <div className="text-xl font-bold text-slate-200 font-mono mt-0.5 font-semibold text-emerald-400">
                {(maxConfidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-850 text-purple-400">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase font-mono">Workflow ID</div>
              <div className="text-xs font-semibold text-slate-400 font-mono mt-1 select-all truncate max-w-[150px]">
                {id.substring(0, 8)}...
              </div>
            </div>
          </div>
        </div>

        {/* RCA Status Alert banner */}
        <div className={`p-4 rounded-xl border text-xs font-mono flex items-center justify-between shadow-sm ${
          analysisStatus === "low_confidence" 
            ? "bg-amber-950/20 border-amber-900/40 text-amber-400" 
            : "bg-emerald-950/15 border-emerald-900/30 text-emerald-400"
        }`}>
          <span className="flex items-center gap-2">
            {analysisStatus === "low_confidence" ? (
              <>
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                <span>RCA model warning: Confidence thresholds computed below optimal levels.</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>RCA hypotheses verified and backed by active runtime logs.</span>
              </>
            )}
          </span>
          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-850 shrink-0">
            CONFIDENCE_MODE: {analysisStatus.toUpperCase()}
          </span>
        </div>

        {/* List of Hypotheses (Requirement 16.5 empty state check) */}
        {hypotheses.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 shadow-xl font-mono text-xs">
            No root cause hypotheses were generated for this investigation.
          </div>
        ) : (
          <div className="space-y-4">
            {hypotheses.map((hyp: any, index: number) => (
              <HypothesisCard
                key={index}
                rank={index + 1}
                hypothesis={hyp.hypothesis}
                confidenceScore={hyp.confidence_score}
                evidence={hyp.evidence}
              />
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
