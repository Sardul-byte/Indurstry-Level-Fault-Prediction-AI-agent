"use client";

import React from "react";
import Link from "next/link";
import { getRecommendations, getInvestigation } from "../../../lib/api";
import { usePolling } from "../../../lib/polling";
import { RemediationStepCard } from "../../../components/recommendations/RemediationStepCard";

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
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-center items-center">
        <div className="max-w-md w-full bg-red-950/20 border border-red-900 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <span className="text-3xl">⚠️</span>
          <h1 className="text-xl font-bold text-red-400">Recommendations Blocked</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Remediation steps are unavailable because the investigation failed or could not analyze logs.
          </p>
          <Link href={`/investigation/${id}`} className="inline-block py-2.5 px-5 bg-slate-900 text-slate-300 rounded-xl border border-slate-800 text-sm font-semibold transition hover:bg-slate-800">
            View Live Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // 2. Disable navigation if not completed (Requirement 16.4)
  if (status !== "completed") {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-center items-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <span className="text-3xl">🔒</span>
          <h1 className="text-xl font-bold text-slate-300">Recommendations Locked</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Recommendations are locked until the investigation completes. Status: <span className="font-semibold text-cyan-400">{status}</span>.
          </p>
          <Link href={`/investigation/${id}`} className="inline-block py-2.5 px-5 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded-xl text-sm font-semibold transition hover:bg-cyan-900">
            View Live Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // 3. Handle pending loading state (Requirement 9.2)
  if (recStatus === "pending" || !recData) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-center items-center">
        <div className="flex flex-col items-center space-y-4 font-semibold text-sm text-slate-400">
          <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <span>Formulating recommendations...</span>
        </div>
      </main>
    );
  }

  const steps = recData.steps || [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,#0c4a6e10,#000_100%)] -z-10" />

      {isStale && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs py-2 px-4 text-center font-medium sticky top-0 z-50 backdrop-blur">
          ⚠️ Connection lost. Serving cached recommendations.
        </div>
      )}

      {/* Header section */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-mono">
                Remediation Actions
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-200 font-mono">
              Action Plan Recommendations
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
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-slate-700 transition"
            >
              RCA Results
            </Link>
            <Link 
              href={`/investigation/${id}/recommendations`}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 border border-slate-850 text-cyan-400 cursor-default"
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
        
        {/* Helper guide */}
        <div className="p-4 bg-slate-900 border border-slate-800 text-xs text-slate-400 rounded-xl leading-relaxed">
          Recommendations are prioritized based on the **confidence of the matching root cause hypothesis**, and categorized in order: **Operational** (restarts, scale ups), **Configuration** (env patches), and **Code Changes** (software updates).
        </div>

        {/* Steps List (Requirement 16.5 empty state check) */}
        {steps.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 shadow-xl font-mono text-sm">
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
