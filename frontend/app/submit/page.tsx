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
    if (env.toLowerCase() === "production") return "bg-danger/10 border-danger/30 text-danger";
    if (env.toLowerCase() === "staging") return "bg-warning/10 border-warning/30 text-warning";
    return "bg-primary-light border-primary-muted text-primary";
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40" />
      
      <div className="relative z-10 max-w-4xl mx-auto w-full space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary-light border border-primary-muted text-primary text-xs font-semibold uppercase tracking-wider font-mono">
            🚨 AI Incident response commander
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Incident Submission Triage
          </h1>
          
          <p className="max-w-2xl mx-auto text-muted-foreground text-sm md:text-base leading-relaxed">
            Upload incident alerts and raw server logs. Our multi-agent AI system will autonomously investigate the failure, analyze log anomalies, retrieve relevant runbooks, pinpoint the root cause, and produce action items.
          </p>
        </div>

        <div className="mt-8">
          <IncidentForm onSuccess={handleSuccess} />
        </div>

        {/* Recent Investigations History Console */}
        {recents.length > 0 && (
          <div className="space-y-4 pt-6 border-t border-border">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-mono">
                Recent Triage History
              </h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {recents.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(`/investigation/${item.id}`)}
                  className="p-4 rounded-xl bg-surface border border-border hover:border-primary/40 hover:bg-surface-raised transition group flex flex-col justify-between text-left space-y-4 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-1.5 text-foreground group-hover:text-primary transition font-mono font-bold text-xs">
                        <Server className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[120px]">{item.serviceName}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border shrink-0 ${getEnvColor(item.environment)}`}>
                        {item.environment}
                      </span>
                    </div>
                    
                    <p className="text-[10px] text-muted-foreground font-mono font-bold select-all truncate">
                      ID: {item.id.substring(0, 8)}...
                    </p>
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground border-t border-border pt-2 w-full">
                    <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="flex items-center gap-1 font-bold group-hover:text-primary transition uppercase tracking-wider text-[8px]">
                      View Dashboard <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
