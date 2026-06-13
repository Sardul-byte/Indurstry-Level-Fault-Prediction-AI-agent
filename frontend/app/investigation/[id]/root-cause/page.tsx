"use client";

import React from "react";
import Link from "next/link";
import { getInvestigation } from "../../../lib/api";
import { usePolling } from "../../../lib/polling";
import { HypothesisCard } from "../../../components/rca/HypothesisCard";

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
  const isCompleted = status === "completed";

  // If not completed yet, disable access (Requirement 16.4)
  if (status !== "completed") {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-center items-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <span className="text-3xl">🔒</span>
          <h1 className="text-xl font-bold text-slate-300">Analysis Unavailable</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            The Root Cause Analysis is unavailable until the investigation completes. Current status: <span className="font-semibold text-cyan-400">{status}</span>.
          </p>
          <Link href={`/investigation/${id}`} className="inline-block py-2.5 px-5 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded-xl text-sm font-semibold transition hover:bg-cyan-900">
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,#0c4a6e10,#000_100%)] -z-10" />

      {/* Header section */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-mono">
                RCA Investigation
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-200 font-mono">
              Root Cause Hypotheses
            </h1>
          </div>

          <nav className="flex gap-2">
            <Link 
              href={`/investigation/${id}`}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-slate-700 transition"
            >
              Dashboard
            </Link>
            <Link 
              href={`/investigation/${id}/root-cause`}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 border border-slate-850 text-cyan-400 cursor-default"
            >
              RCA Results
            </Link>
            <Link 
              href={`/investigation/${id}/recommendations`}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-slate-700 transition"
            >
              Recommendations
            </Link>
            <Link 
              href={`/investigation/${id}/postmortem`}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-slate-700 transition"
            >
              Postmortem report
            </Link>
          </nav>
        </div>
      </header>

      {/* Main container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        
        {/* RCA Status Alert banner */}
        <div className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
          analysisStatus === "low_confidence" 
            ? "bg-amber-950/20 border-amber-900/40 text-amber-400" 
            : "bg-emerald-950/10 border-emerald-900/30 text-emerald-400"
        }`}>
          <span>
            {analysisStatus === "low_confidence" 
              ? "⚠️ Root cause analysis completed with Low Confidence thresholds."
              : "✓ Root cause hypotheses generated and validated successfully."
            }
          </span>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-950 border border-slate-850">
            status: {analysisStatus}
          </span>
        </div>

        {/* List of Hypotheses (Requirement 16.5 empty state check) */}
        {hypotheses.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 shadow-xl font-mono text-sm">
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
