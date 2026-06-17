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
      <main className="min-h-screen bg-background text-foreground p-8 flex flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,rgba(13,122,110,0.05),transparent_100%)] -z-10" />
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-surface-raised border border-border flex items-center justify-center mx-auto text-2xl shadow-inner">
            🔒
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-foreground uppercase tracking-wider font-mono">Analysis Locked</h1>
            <p className="text-muted-foreground text-xs leading-relaxed font-mono">
              The Root Cause Analysis report is generated once the incident pipeline reaches completion.
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
    <main className="min-h-screen bg-background text-foreground pb-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_0%,rgba(13,122,110,0.05),transparent_100%)] -z-10" />

      {/* Header section */}
      <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                RCA Node Complete
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-extrabold text-foreground font-mono tracking-tight flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-primary" />
              Root Cause Hypotheses
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
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-lg bg-primary-light border border-primary-muted text-primary flex items-center gap-1.5 font-mono uppercase tracking-wider"
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
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-lg text-muted-foreground hover:text-primary hover:bg-surface-raised transition flex items-center gap-1.5 font-mono uppercase tracking-wider"
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
          <div className="bg-surface border border-border p-4 rounded-xl flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-surface-raised flex items-center justify-center border border-border text-primary">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase font-mono">Total Hypotheses</div>
              <div className="text-xl font-bold text-foreground font-mono mt-0.5">{totalHypotheses}</div>
            </div>
          </div>
          
          <div className="bg-surface border border-border p-4 rounded-xl flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-surface-raised flex items-center justify-center border border-border text-success">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase font-mono">Max Confidence</div>
              <div className="text-xl font-bold text-success font-mono mt-0.5 font-semibold">
                {(maxConfidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          
          <div className="bg-surface border border-border p-4 rounded-xl flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-surface-raised flex items-center justify-center border border-border text-primary">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase font-mono">Workflow ID</div>
              <div className="text-xs font-semibold text-muted-foreground font-mono mt-1 select-all truncate max-w-[150px]">
                {id.substring(0, 8)}...
              </div>
            </div>
          </div>
        </div>

        {/* RCA Status Alert banner */}
        <div className={`p-4 rounded-xl border text-xs font-mono flex items-center justify-between shadow-sm ${
          analysisStatus === "low_confidence" 
            ? "bg-warning/10 border-warning/30 text-warning" 
            : "bg-success/10 border-success/30 text-success"
        }`}>
          <span className="flex items-center gap-2">
            {analysisStatus === "low_confidence" ? (
              <>
                <ShieldAlert className="w-4 h-4 text-warning shrink-0 animate-pulse" />
                <span>RCA model warning: Confidence thresholds computed below optimal levels.</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-success" />
                <span>RCA hypotheses verified and backed by active runtime logs.</span>
              </>
            )}
          </span>
          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-surface border border-border shrink-0">
            CONFIDENCE_MODE: {analysisStatus.toUpperCase()}
          </span>
        </div>

        {/* List of Hypotheses (Requirement 16.5 empty state check) */}
        {hypotheses.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center text-muted-foreground shadow-sm font-mono text-xs">
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
