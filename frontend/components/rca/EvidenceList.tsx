import React from "react";
import { Check } from "lucide-react";

interface EvidenceListProps {
  evidence: string[];
}

export function EvidenceList({ evidence }: EvidenceListProps) {
  if (!evidence || evidence.length === 0) return null;
  return (
    <ul className="space-y-2.5 text-xs text-slate-400">
      {evidence.map((item, index) => (
        <li key={index} className="leading-relaxed flex items-start gap-2.5 bg-slate-950/40 border border-slate-900/50 p-3 rounded-xl font-mono text-[11px]">
          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
