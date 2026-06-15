"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IncidentForm } from "../../components/submission/IncidentForm";
import { Server, ArrowRight, Activity } from "lucide-react";

interface RecentInvestigation {
  id: string;
  serviceName: string;
  environment: string;
  timestamp: string;
}

export default function SubmitPage() {
  const router = useRouter();
  const [recents, setRecents] = useState<RecentInvestigation[]>([]);

  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem("recent_investigations") || "[]");
      setRecents(list);
    } catch (e) {
      console.error("Failed to load recents from localStorage:", e);
    }
  }, []);

  const handleSuccess = (id: string) => {
    router.push(`/investigation/${id}`);
  };

  const getEnvColor = (env: string) => {
    if (env.toLowerCase() === "production") return "bg-red-500/10 border-red-500/30 text-red-400";
    if (env.toLowerCase() === "staging") return "bg-amber-500/10 border-amber-500/30 text-amber-400";
    return "bg-cyan-500/10 border-cyan-500/30 text-cyan-400";
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60" />
      
      <div className="relative z-10 max-w-4xl mx-auto w-full space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/50 border border-cyan-800/35 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
            🚨 AI Incident response commander
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">
            Incident Submission Triage
          </h1>
          
          <p className="max-w-2xl mx-auto text-slate-400 text-sm md:text-base leading-relaxed">
            Upload incident alerts and raw server logs. Our multi-agent AI system will autonomously investigate the failure, analyze log anomalies, retrieve relevant runbooks, pinpoint the root cause, and produce action items.
          </p>
        </div>

        <div className="mt-8">
          <IncidentForm onSuccess={handleSuccess} />
        </div>

        {/* Recent Investigations History Console */}
        {recents.length > 0 && (
          <div className="space-y-4 pt-6 border-t border-slate-900/80">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
                Recent Triage History
              </h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {recents.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(`/investigation/${item.id}`)}
                  className="p-4 rounded-xl bg-slate-900/40 border border-slate-850 hover:border-cyan-500/40 hover:bg-slate-900/60 transition group flex flex-col justify-between text-left space-y-4 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-1.5 text-slate-200 group-hover:text-cyan-400 transition font-mono font-bold text-xs">
                        <Server className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[120px]">{item.serviceName}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border shrink-0 ${getEnvColor(item.environment)}`}>
                        {item.environment}
                      </span>
                    </div>
                    
                    <p className="text-[10px] text-slate-500 font-mono font-bold select-all truncate">
                      ID: {item.id.substring(0, 8)}...
                    </p>
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-550 border-t border-slate-900/60 pt-2 w-full">
                    <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="flex items-center gap-1 font-bold group-hover:text-cyan-400 transition uppercase tracking-wider text-[8px]">
                      View Dashboard <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
