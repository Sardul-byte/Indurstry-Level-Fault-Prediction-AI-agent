"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { IncidentForm } from "../../components/submission/IncidentForm";

export default function SubmitPage() {
  const router = useRouter();

  const handleSuccess = (id: string) => {
    router.push(`/investigation/${id}`);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60" />
      
      <div className="relative z-10 max-w-4xl mx-auto w-full space-y-8">
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
      </div>
    </main>
  );
}
