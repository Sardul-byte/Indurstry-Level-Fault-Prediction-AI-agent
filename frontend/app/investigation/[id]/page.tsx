"use client";

import React from "react";
import Link from "next/link";
import { usePolling } from "../../../lib/polling";
import { getInvestigation } from "../../../lib/api";
import { WorkflowStageBar } from "../../../components/dashboard/WorkflowStageBar";
import { AgentStatusCard } from "../../../components/dashboard/AgentStatusCard";
import { RetrievedEvidencePanel } from "../../../components/dashboard/RetrievedEvidencePanel";

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
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-center items-center">
        <div className="max-w-md w-full bg-red-950/20 border border-red-900 rounded-2xl p-6 text-center space-y-4">
          <span className="text-3xl">⚠️</span>
          <h1 className="text-xl font-bold text-red-400">Failed to Load Investigation</h1>
          <p className="text-slate-400 text-sm">{error.message}</p>
          <Link href="/submit" className="inline-block py-2.5 px-5 bg-slate-900 text-slate-300 rounded-xl hover:bg-slate-800 border border-slate-800 text-sm font-semibold transition">
            Return to Submit
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
    // Check if output exists for this agent
    const out = agentOutputs.find((o) => o.agent_name === agentName);
    if (out) return "completed";

    // If workflow failed at this agent stage
    if (status === "failed") {
      // Find which agent failed (let's assume it failed if it's the current active stage)
      // We can also check if error has this agent name
      const isFailedAgent = (stage === "triaging" && (agentName === "alert_agent" || agentName === "log_analysis_agent" || agentName === "retrieval_agent"))
        || (stage === "root_cause_analysis" && agentName === "rca_agent")
        || (stage === "remediation" && agentName === "remediation_agent")
        || (stage === "verification" && agentName === "postmortem_agent");
      if (isFailedAgent) return "failed";
    }

    // Determine running stage
    if (status === "running" || status === "pending") {
      if (stage === "triaging" && (agentName === "alert_agent" || agentName === "log_analysis_agent" || agentName === "retrieval_agent")) {
        // Since triaging covers first three, we can mark them as running if previous is done
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_0%,#0c4a6e15,#000_100%)] -z-10" />

      {/* Stale data warning indicator (Requirement 15.4) */}
      {isStale && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs py-2 px-4 text-center font-medium sticky top-0 z-50 backdrop-blur">
          ⚠️ Connection lost. Serving stale cached data. Retrying...
        </div>
      )}

      {/* Header section */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-mono">
                System Investigation
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-200 font-mono">
              Dashboard — {id.substring(0, 8)}...
            </h1>
          </div>

          {/* Navigation controls (Requirement 16.3, 16.4) */}
          <nav className="flex gap-2">
            <Link 
              href={`/investigation/${id}`}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 cursor-default"
            >
              Dashboard
            </Link>
            
            {isCompleted ? (
              <>
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
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-slate-700 transition"
                >
                  Postmortem report
                </Link>
              </>
            ) : (
              <>
                <span 
                  title="Available once investigation completes"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900/50 border border-slate-900/50 text-slate-600 cursor-not-allowed flex items-center gap-1.5"
                >
                  🔒 RCA Results
                </span>
                <span 
                  title="Available once investigation completes"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900/50 border border-slate-900/50 text-slate-600 cursor-not-allowed flex items-center gap-1.5"
                >
                  🔒 Recommendations
                </span>
                <span 
                  title="Available once investigation completes"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900/50 border border-slate-900/50 text-slate-600 cursor-not-allowed flex items-center gap-1.5"
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
        
        {/* Progress Pipeline */}
        <WorkflowStageBar currentStage={stage} />

        {/* Dynamic status alert */}
        {status === "failed" && (
          <div className="p-5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-start gap-4">
            <span className="text-xl">🛑</span>
            <div className="space-y-1">
              <h4 className="font-bold text-red-300">Investigation Pipeline Failed</h4>
              <p className="text-xs text-red-400 leading-relaxed font-mono">
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
            <RetrievedEvidencePanel retrievalContext={retOut} />
          </div>
        )}

      </div>
    </main>
  );
}
