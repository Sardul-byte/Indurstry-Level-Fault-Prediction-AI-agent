"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getReport, getInvestigation } from "../../../../lib/api";
import { usePolling } from "../../../../lib/polling";
import { PostmortemSection } from "../../../../components/postmortem/PostmortemSection";
import { ExportButton } from "../../../../components/postmortem/ExportButton";
import { 
  LayoutDashboard, 
  Lightbulb, 
  CheckSquare, 
  FileText, 
  AlertTriangle, 
  Loader2, 
  FileCheck2,
  FileSpreadsheet
} from "lucide-react";

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
      <main className="min-h-screen bg-background text-foreground p-8 flex flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,rgba(13,122,110,0.05),transparent_100%)] -z-10" />
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-surface-raised border border-border flex items-center justify-center mx-auto text-2xl shadow-inner">
            🔒
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-foreground uppercase tracking-wider font-mono">Report Locked</h1>
            <p className="text-muted-foreground text-xs leading-relaxed font-mono">
              The Postmortem Report is unavailable until the investigation completes.
            </p>
          </div>
          <div className="p-3 bg-surface-raised rounded-xl border border-border text-[11px] font-mono text-muted-foreground">
            Current status: <span className="font-semibold text-primary">{status}</span>
          </div>
          <Link href={`/investigation/${id}`} className="inline-block w-full py-2.5 px-5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold transition shadow-md">
            View Live Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // Handle timeout after 30 attempts (Requirement 17.4)
  if (hasTimedOut) {
    return (
      <main className="min-h-screen bg-background text-foreground p-8 flex flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,rgba(220,38,38,0.05),transparent_100%)] -z-10" />
        <div className="max-w-md w-full bg-surface border border-danger/30 rounded-2xl p-8 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center mx-auto text-danger text-2xl shadow-inner">
            ⏳
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-danger uppercase tracking-wider font-mono">Report Generation Timed Out</h1>
            <p className="text-muted-foreground text-xs leading-relaxed font-mono">
              We polled for the postmortem 30 times (5 minutes) but it is not yet ready. Please try again.
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-5 bg-surface hover:bg-surface-raised text-foreground rounded-xl border border-border text-xs font-bold transition shadow-sm"
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
      <main className="min-h-screen bg-background text-foreground p-8 flex flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_0%,rgba(13,122,110,0.05),transparent_100%)] -z-10" />
        <div className="flex flex-col items-center space-y-4 font-mono text-xs text-muted-foreground">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <span className="font-bold uppercase tracking-widest text-[10px]">Generating Postmortem... ({pollCount}/30 attempts)</span>
        </div>
      </main>
    );
  }

  const sections = report.sections || [];
  const reportStatus = report.postmortem_status;

  return (
    <main className="min-h-screen bg-background text-foreground pb-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_0%,rgba(13,122,110,0.05),transparent_100%)] -z-10" />

      {isStale && (
        <div className="w-full bg-warning/10 border-b border-warning/20 text-warning text-[10px] py-2 px-4 text-center font-bold tracking-wider font-mono sticky top-0 z-50 backdrop-blur uppercase flex items-center justify-center gap-1.5 shadow-sm">
          <AlertTriangle className="w-3.5 h-3.5 animate-pulse" /> Connection lost. Serving cached postmortem report.
        </div>
      )}

      {/* Header section */}
      <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                Postmortem Summary
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-extrabold text-foreground font-mono tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Incident Postmortem report
            </h1>
          </div>

          <nav className="flex gap-1.5 bg-surface-raised p-1 rounded-xl border border-border">
            <Link 
              href={`/investigation/${id}`}
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-lg text-muted-foreground hover:text-primary hover:bg-surface-raised transition flex items-center gap-1.5 font-mono uppercase tracking-wider"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </Link>
            <Link 
              href={`/investigation/${id}/root-cause`}
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-lg text-muted-foreground hover:text-primary hover:bg-surface-raised transition flex items-center gap-1.5 font-mono uppercase tracking-wider"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              RCA Results
            </Link>
            <Link 
              href={`/investigation/${id}/recommendations`}
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-lg text-muted-foreground hover:text-primary hover:bg-surface-raised transition flex items-center gap-1.5 font-mono uppercase tracking-wider"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Recommendations
            </Link>
            <Link 
              href={`/investigation/${id}/postmortem`}
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-lg bg-primary-light border border-primary-muted text-primary flex items-center gap-1.5 font-mono uppercase tracking-wider"
            >
              <FileText className="w-3.5 h-3.5" />
              Postmortem
            </Link>
          </nav>
        </div>
      </header>

      {/* Main container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        
        {/* Actions bar */}
        <div className="flex justify-between items-center gap-4 flex-wrap bg-surface border border-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-mono">
            <FileCheck2 className="w-4.5 h-4.5 text-success" />
            <span>Postmortem compiled and attributed by the **Postmortem Agent**.</span>
          </div>
          {/* Export button (Requirement 17.2) */}
          {reportStatus === "ready" && (
            <ExportButton investigationId={id} />
          )}
        </div>

        {reportStatus === "incomplete_inputs" && (
          <div className="p-4 bg-warning/10 border border-warning/25 text-warning text-xs font-mono rounded-xl leading-relaxed flex items-center gap-2 shadow-inner">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 animate-pulse" />
            <span>The postmortem is incomplete due to missing inputs: **{report.missing_inputs?.join(", ")}**. Showing fallback data sections.</span>
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
