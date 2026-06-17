"use client";

import React from "react";
import Link from "next/link";
import { usePolling } from "../../../lib/polling";
import { getInvestigation } from "../../../lib/api";
import { WorkflowStageBar } from "../../../components/dashboard/WorkflowStageBar";
import { AgentStatusCard } from "../../../components/dashboard/AgentStatusCard";
import { RetrievedEvidencePanel } from "../../../components/dashboard/RetrievedEvidencePanel";
import { 
  LayoutDashboard, 
  Activity, 
  ShieldCheck, 
  FileText, 
  Server, 
  Globe, 
  Clock, 
  ArrowLeft,
  RefreshCw,
  AlertOctagon,
  Fingerprint
} from "lucide-react";

interface PageProps {
  params: { id: string };
}

const ALL_AGENTS = [
  "alert_agent",
  "log_analysis_agent",
  "retrieval_agent",
  "rca_agent",
  "remediation_agent",
  "postmortem_agent",
];

export default function InvestigationDashboardPage({ params }: PageProps) {
  const id = params.id;

  // Poll investigation status every 5 seconds until it completes or fails (Requirement 15.3)
  const { data, isStale, error } = usePolling(
    () => getInvestigation(id),
    5000,
    (d) => d.status === "completed" || d.status === "failed"
  );

  if (error && !data) {
    return (
      <main className="min-h-screen bg-background text-foreground p-8 flex flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,rgba(220,38,38,0.05),transparent_100%)] -z-10" />
        <div className="max-w-md w-full bg-surface border border-danger/30 rounded-2xl p-6 text-center space-y-4 shadow-md">
          <AlertOctagon className="w-12 h-12 text-danger mx-auto animate-pulse" />
          <h1 className="text-xl font-bold text-danger font-mono">Failed to Load Investigation</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{error.message}</p>
          <Link 
            href="/submit" 
            className="inline-flex items-center gap-2 py-2.5 px-5 bg-surface text-foreground rounded-xl hover:bg-surface-raised border border-border text-xs font-bold transition shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Submit
          </Link>
        </div>
      </main>
    );
  }

  const status = data?.status || "pending";
  const stage = data?.stage || "triaging";
  const agentOutputs = data?.agent_outputs || [];

  // Helper to compute status for each agent card
  const getAgentStatus = (agentName: string) => {
    const out = agentOutputs.find((o) => o.agent_name === agentName);
    if (out) return "completed";

    if (status === "failed") {
      const isFailedAgent = (stage === "triaging" && (agentName === "alert_agent" || agentName === "log_analysis_agent" || agentName === "retrieval_agent"))
        || (stage === "root_cause_analysis" && agentName === "rca_agent")
        || (stage === "remediation" && agentName === "remediation_agent")
        || (stage === "verification" && agentName === "postmortem_agent");
      if (isFailedAgent) return "failed";
    }

    if (status === "running" || status === "pending") {
      if (stage === "triaging" && (agentName === "alert_agent" || agentName === "log_analysis_agent" || agentName === "retrieval_agent")) {
        const prevIndex = ALL_AGENTS.indexOf(agentName) - 1;
        if (prevIndex === -1 || agentOutputs.some((o) => o.agent_name === ALL_AGENTS[prevIndex])) {
          return "running";
        }
      }
      if (stage === "root_cause_analysis" && agentName === "rca_agent") return "running";
      if (stage === "remediation" && agentName === "remediation_agent") return "running";
      if (stage === "verification" && agentName === "postmortem_agent") return "running";
    }

    return "pending";
  };

  const alertOut = agentOutputs.find((o) => o.agent_name === "alert_agent")?.output;
  const logOut = agentOutputs.find((o) => o.agent_name === "log_analysis_agent")?.output;
  const retOut = agentOutputs.find((o) => o.agent_name === "retrieval_agent")?.output;
  const rcaOut = agentOutputs.find((o) => o.agent_name === "rca_agent")?.output;
  const remOut = agentOutputs.find((o) => o.agent_name === "remediation_agent")?.output;
  const pmOut = agentOutputs.find((o) => o.agent_name === "postmortem_agent")?.output;

  const isCompleted = status === "completed";
  
  // Extract metadata if available
  const serviceName = alertOut?.impacted_services?.[0] || "detecting...";
  const severity = alertOut?.severity || "detecting...";

  return (
    <main className="min-h-screen bg-background text-foreground pb-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,rgba(13,122,110,0.05),transparent_100%)] -z-10" />

      {/* Stale data warning indicator (Requirement 15.4) */}
      {isStale && (
        <div className="w-full bg-warning/10 border-b border-warning/20 text-warning text-[10px] md:text-xs py-2 px-4 text-center font-bold tracking-wider uppercase sticky top-0 z-50 backdrop-blur flex items-center justify-center gap-2 animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Connection lost. Serving cached local snapshot. Retrying...
        </div>
      )}

      {/* Header section */}
      <header className="border-b border-border bg-surface/70 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                status === "failed" ? "bg-danger" : isCompleted ? "bg-success" : "bg-primary"
              }`} />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                AI Agent Triage Console
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-extrabold text-foreground font-mono tracking-tight flex items-center gap-2">
              Incident ID: <span className="text-primary">{id.substring(0, 8)}</span>
            </h1>
          </div>

          {/* Navigation controls (Requirement 16.3, 16.4) */}
          <nav className="flex items-center gap-1.5 bg-surface-raised border border-border p-1.5 rounded-xl">
            <Link 
              href={`/investigation/${id}`}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-primary-light border border-primary-muted text-primary"
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
            </Link>
            
            {isCompleted ? (
              <>
                <Link 
                  href={`/investigation/${id}/root-cause`}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-transparent text-muted-foreground hover:text-primary hover:bg-surface-raised transition"
                >
                  <Activity className="w-3.5 h-3.5 text-muted-foreground/80 group-hover:text-primary" /> RCA Results
                </Link>
                <Link 
                  href={`/investigation/${id}/recommendations`}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-transparent text-muted-foreground hover:text-primary hover:bg-surface-raised transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/80 group-hover:text-primary" /> Recommendations
                </Link>
                <Link 
                  href={`/investigation/${id}/postmortem`}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-transparent text-muted-foreground hover:text-primary hover:bg-surface-raised transition"
                >
                  <FileText className="w-3.5 h-3.5 text-muted-foreground/80 group-hover:text-primary" /> Postmortem Report
                </Link>
              </>
            ) : (
              <>
                <span 
                  title="Available once investigation completes"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg text-muted-foreground/40 cursor-not-allowed"
                >
                  🔒 RCA
                </span>
                <span 
                  title="Available once investigation completes"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg text-muted-foreground/40 cursor-not-allowed"
                >
                  🔒 Recommendations
                </span>
                <span 
                  title="Available once investigation completes"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg text-muted-foreground/40 cursor-not-allowed"
                >
                  🔒 Postmortem
                </span>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {/* Metadata Banner Card */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-surface border border-border p-5 rounded-2xl text-xs font-semibold shadow-sm">
          <div className="flex items-center gap-3">
            <Server className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider font-mono">Service Name</p>
              <p className="text-foreground mt-0.5 truncate max-w-[150px]" title={serviceName}>{serviceName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider font-mono">Severity</p>
              <p className="text-foreground mt-0.5 capitalize">{severity}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider font-mono">Workflow Status</p>
              <p className="text-foreground mt-0.5 capitalize">{status}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Fingerprint className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider font-mono">Request Trace</p>
              <p className="text-foreground mt-0.5 font-mono text-[10px]">{data?.investigation_id?.substring(0, 18)}...</p>
            </div>
          </div>
        </div>
        
        {/* Progress Pipeline */}
        <WorkflowStageBar currentStage={stage} />

        {/* Dynamic status alert */}
        {status === "failed" && (
          <div className="p-5 bg-danger/10 border border-danger/30 text-danger rounded-2xl flex items-start gap-4">
            <AlertOctagon className="w-6 h-6 text-danger shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-danger text-sm">Investigation Pipeline Aborted</h4>
              <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                Reason: {data?.agent_outputs?.find(o => o.output?.error)?.output?.error || "An unhandled exception occurred in the agent nodes."}
              </p>
            </div>
          </div>
        )}

        {/* Kanban Board Layout for Agent Status Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Phase 1: Ingestion & Triage */}
          <div className="bg-surface/50 border border-border/80 p-5 rounded-2xl flex flex-col gap-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="text-xs font-bold text-foreground font-mono uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-primary shrink-0" />
                Phase 1: Ingestion & Triage
              </span>
              <span className="px-2 py-0.5 rounded-full bg-primary-light border border-primary-muted text-primary text-[9px] font-bold font-mono">
                Steps 1-3
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/85 leading-relaxed font-mono italic">
              Classifies incoming alerts, scans target server logs, and queries vectorized runbooks for matches.
            </p>
            <div className="flex flex-col gap-4">
              <AgentStatusCard agentName="alert_agent" status={getAgentStatus("alert_agent")} output={alertOut} />
              <AgentStatusCard agentName="log_analysis_agent" status={getAgentStatus("log_analysis_agent")} output={logOut} />
              <AgentStatusCard agentName="retrieval_agent" status={getAgentStatus("retrieval_agent")} output={retOut} />
            </div>
          </div>

          {/* Phase 2: Root Cause Engine */}
          <div className="bg-surface/50 border border-border/80 p-5 rounded-2xl flex flex-col gap-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="text-xs font-bold text-foreground font-mono uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary shrink-0" />
                Phase 2: Analysis Engine
              </span>
              <span className="px-2 py-0.5 rounded-full bg-primary-light border border-primary-muted text-primary text-[9px] font-bold font-mono">
                Steps 4-5
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/85 leading-relaxed font-mono italic">
              Evaluates fault hypotheses with relevance scores and outlines concrete remediation steps.
            </p>
            <div className="flex flex-col gap-4">
              <AgentStatusCard agentName="rca_agent" status={getAgentStatus("rca_agent")} output={rcaOut} />
              <AgentStatusCard agentName="remediation_agent" status={getAgentStatus("remediation_agent")} output={remOut} />
            </div>
          </div>

          {/* Phase 3: Reporting & Verification */}
          <div className="bg-surface/50 border border-border/80 p-5 rounded-2xl flex flex-col gap-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="text-xs font-bold text-foreground font-mono uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                Phase 3: Verification & Report
              </span>
              <span className="px-2 py-0.5 rounded-full bg-primary-light border border-primary-muted text-primary text-[9px] font-bold font-mono">
                Step 6
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/85 leading-relaxed font-mono italic">
              Compiles investigation timeline, root cause, and recommendations into the final postmortem log.
            </p>
            <div className="flex flex-col gap-4">
              <AgentStatusCard agentName="postmortem_agent" status={getAgentStatus("postmortem_agent")} output={pmOut} />
            </div>
          </div>
        </div>

        {/* Injected retrieval evidence panel (Requirement 15.5) */}
        {retOut && (
          <div className="mt-8">
            <RetrievedEvidencePanel retrievalContext={retOut as any} />
          </div>
        )}

      </div>
    </main>
  );
}
