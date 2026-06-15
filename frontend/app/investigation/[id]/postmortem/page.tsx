"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getReport, getInvestigation } from "../../../../lib/api";
import { usePolling } from "../../../../lib/polling";
import { PostmortemSection } from "../../../../components/postmortem/PostmortemSection";
import { ExportButton } from "../../../../components/postmortem/ExportButton";

interface PageProps {
  params: { id: string };
}

export default function PostmortemPage({ params }: PageProps) {
  const id = params.id;

  // Poll investigation status to verify that the investigation is completed
  const { data: invData } = usePolling(
    () => getInvestigation(id),
    5000,
    (d) => d.status === "completed" || d.status === "failed"
  );

  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [isStale, setIsStale] = useState(false);

  const status = invData?.status || "pending";

  // Polling logic for report (Requirement 17.3 & 17.4)
  useEffect(() => {
    if (status !== "completed") return; // Only poll once investigation completes

    let active = true;
    let attempts = 0;
    let timerId: number;

    async function checkReport() {
      try {
        attempts++;
        if (active) setPollCount(attempts);

        const res = await getReport(id);
        if (!active) return;

        if (res.postmortem_status === "ready" || res.postmortem_status === "incomplete_inputs") {
          setReport(res);
          setLoading(false);
          window.clearInterval(timerId);
        } else {
          // Still pending
          if (attempts >= 30) {
            setHasTimedOut(true);
            setLoading(false);
            window.clearInterval(timerId);
          }
        }
        setIsStale(false);
      } catch (err) {
        if (!active) return;
        setIsStale(true);
        if (attempts >= 30) {
          setHasTimedOut(true);
          setLoading(false);
          window.clearInterval(timerId);
        }
      }
    }

    checkReport();
    timerId = window.setInterval(checkReport, 10000); // 10-second intervals (Requirement 17.3)

    return () => {
      active = false;
      window.clearInterval(timerId);
    };
  }, [id, status]);

  // Disable access if investigation not complete (Requirement 16.4)
  if (status !== "completed") {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-center items-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <span className="text-3xl">🔒</span>
          <h1 className="text-xl font-bold text-slate-300">Report Unavailable</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            The Postmortem Report is unavailable until the investigation completes. Status: <span className="font-semibold text-cyan-400">{status}</span>.
          </p>
          <Link href={`/investigation/${id}`} className="inline-block py-2.5 px-5 bg-cyan-950 border border-cyan-800 text-cyan-400 rounded-xl text-sm font-semibold transition hover:bg-cyan-900">
            View Live Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // Handle timeout after 30 attempts (Requirement 17.4)
  if (hasTimedOut) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-center items-center">
        <div className="max-w-md w-full bg-red-950/20 border border-red-900 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <span className="text-3xl">⏳</span>
          <h1 className="text-xl font-bold text-red-400">Postmortem Generation Timed Out</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            We polled for the postmortem 30 times (5 minutes) but it is not yet ready. Please try again later.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="inline-block py-2.5 px-5 bg-slate-900 text-slate-300 rounded-xl border border-slate-800 text-sm font-semibold transition hover:bg-slate-800"
          >
            Retry Polling
          </button>
        </div>
      </main>
    );
  }

  // Handle loading spinner (Requirement 17.3)
  if (loading || !report) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-center items-center">
        <div className="flex flex-col items-center space-y-4 font-semibold text-sm text-slate-400">
          <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <span>Generating structured postmortem report... ({pollCount}/30 attempts)</span>
        </div>
      </main>
    );
  }

  const sections = report.sections || [];
  const reportStatus = report.postmortem_status;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,#0c4a6e10,#000_100%)] -z-10" />

      {isStale && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs py-2 px-4 text-center font-medium sticky top-0 z-50 backdrop-blur">
          ⚠️ Connection lost. Serving cached postmortem report.
        </div>
      )}

      {/* Header section */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-mono">
                Postmortem Summary
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-200 font-mono">
              Incident Postmortem report
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
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-slate-700 transition"
            >
              Recommendations
            </Link>
            <Link 
              href={`/investigation/${id}/postmortem`}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 border border-slate-850 text-cyan-400 cursor-default"
            >
              Postmortem report
            </Link>
          </nav>
        </div>
      </header>

      {/* Main container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        
        {/* Actions bar */}
        <div className="flex justify-between items-center gap-4 flex-wrap bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="text-xs text-slate-400">
            Postmortem compiled and attributed by the **Postmortem Agent**.
          </div>
          {/* Export button (Requirement 17.2) */}
          {reportStatus === "ready" && (
            <ExportButton investigationId={id} />
          )}
        </div>

        {reportStatus === "incomplete_inputs" && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm rounded-xl leading-relaxed">
            ⚠️ The postmortem is incomplete due to missing inputs: **{report.missing_inputs?.join(", ")}**. Showing skipped/placeholder sections.
          </div>
        )}

        {/* 7 Sections Renderer (Requirement 17.1) */}
        <div className="space-y-6">
          {sections.map((sec: any, index: number) => (
            <PostmortemSection
              key={index}
              heading={sec.heading}
              body={sec.body}
              sourceAgent={sec.source_agent}
            />
          ))}
        </div>

      </div>
    </main>
  );
}
