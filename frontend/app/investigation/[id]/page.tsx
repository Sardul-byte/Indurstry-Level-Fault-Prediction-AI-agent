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
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,#ef44440a,#000_100%)] -z-10" />
        <div className="max-w-md w-full bg-red-950/10 border border-red-900/40 rounded-2xl p-6 text-center space-y-4 shadow-2xl backdrop-blur">
          <AlertOctagon className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
          <h1 className="text-xl font-bold text-red-400 font-mono">Failed to Load Investigation</h1>
          <p className="text-slate-400 text-sm leading-relaxed">{error.message}</p>
          <Link 
            href="/submit" 
            className="inline-flex items-center gap-2 py-2.5 px-5 bg-slate-900 text-slate-300 rounded-xl hover:bg-slate-800 border border-slate-800 text-xs font-bold transition"
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
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,#0c4a6e12,#000_100%)] -z-10" />

      {/* Stale data warning indicator (Requirement 15.4) */}
      {isStale && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-[10px] md:text-xs py-2 px-4 text-center font-bold tracking-wider uppercase sticky top-0 z-50 backdrop-blur flex items-center justify-center gap-2 animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Connection lost. Serving cached local snapshot. Retrying...
        </div>
      )}

      {/* Header section */}
      <header className="border-b border-slate-900 bg-slate-950/70 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full animate-pulse ${
                status === "failed" ? "bg-red-500" : isCompleted ? "bg-emerald-500" : "bg-cyan-500"
              }`} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                AI Agent Triage Console
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-extrabold text-slate-200 font-mono tracking-tight flex items-center gap-2">
              Incident ID: <span className="text-cyan-400">{id.substring(0, 8)}</span>
            </h1>
          </div>

          {/* Navigation controls (Requirement 16.3, 16.4) */}
          <nav className="flex items-center gap-1.5 bg-slate-950 border border-slate-900 p-1.5 rounded-xl">
            <Link 
              href={`/investigation/${id}`}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400"
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
            </Link>
            
            {isCompleted ? (
              <>
                <Link 
                  href={`/investigation/${id}/root-cause`}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-transparent text-slate-400 hover:text-cyan-400 hover:bg-slate-900 transition"
                >
                  <Activity className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" /> RCA Results
                </Link>
                <Link 
                  href={`/investigation/${id}/recommendations`}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-transparent text-slate-400 hover:text-cyan-400 hover:bg-slate-900 transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" /> Recommendations
                </Link>
                <Link 
                  href={`/investigation/${id}/postmortem`}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-transparent text-slate-400 hover:text-cyan-400 hover:bg-slate-900 transition"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" /> Postmortem Report
                </Link>
              </>
            ) : (
              <>
                <span 
                  title="Available once investigation completes"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg text-slate-600 cursor-not-allowed"
                >
                  🔒 RCA
                </span>
                <span 
                  title="Available once investigation completes"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg text-slate-600 cursor-not-allowed"
                >
                  🔒 Recommendations
                </span>
                <span 
                  title="Available once investigation completes"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg text-slate-600 cursor-not-allowed"
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/40 border border-slate-900 p-5 rounded-2xl text-xs font-semibold">
          <div className="flex items-center gap-3">
            <Server className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider font-mono">Service Name</p>
              <p className="text-slate-200 mt-0.5 truncate max-w-[150px]" title={serviceName}>{serviceName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider font-mono">Severity</p>
              <p className="text-slate-200 mt-0.5 capitalize">{severity}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider font-mono">Workflow Status</p>
              <p className="text-slate-200 mt-0.5 capitalize">{status}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Fingerprint className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider font-mono">Request Trace</p>
              <p className="text-slate-200 mt-0.5 font-mono text-[10px]">{data?.investigation_id?.substring(0, 18)}...</p>
            </div>
          </div>
        </div>
        
        {/* Progress Pipeline */}
        <WorkflowStageBar currentStage={stage} />

        {/* Dynamic status alert */}
        {status === "failed" && (
          <div className="p-5 bg-red-950/20 border border-red-900/30 text-red-400 rounded-2xl flex items-start gap-4">
            <AlertOctagon className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-red-300 text-sm">Investigation Pipeline Aborted</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-mono">
                Reason: {data?.agent_outputs?.find(o => o.output?.error)?.output?.error || "An unhandled exception occurred in the agent nodes."}
              </p>
            </div>
          </div>
        )}

        {/* Grid panel for agent status cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AgentStatusCard agentName="alert_agent" status={getAgentStatus("alert_agent")} output={alertOut} />
          <AgentStatusCard agentName="log_analysis_agent" status={getAgentStatus("log_analysis_agent")} output={logOut} />
          <AgentStatusCard agentName="retrieval_agent" status={getAgentStatus("retrieval_agent")} output={retOut} />
          <AgentStatusCard agentName="rca_agent" status={getAgentStatus("rca_agent")} output={rcaOut} />
          <AgentStatusCard agentName="remediation_agent" status={getAgentStatus("remediation_agent")} output={remOut} />
          <AgentStatusCard agentName="postmortem_agent" status={getAgentStatus("postmortem_agent")} output={pmOut} />
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
