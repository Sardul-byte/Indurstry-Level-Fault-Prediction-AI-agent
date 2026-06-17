import React from "react";
import { Check } from "lucide-react";

interface EvidenceListProps {
  evidence: string[];
}

export function EvidenceList({ evidence }: EvidenceListProps) {
  if (!evidence || evidence.length === 0) return null;
  return (
    <ul className="space-y-2.5 text-xs text-muted-foreground">
      {evidence.map((item, index) => (
        <li key={index} className="leading-relaxed flex items-start gap-2.5 bg-surface-raised border border-border p-3 rounded-xl font-mono text-[11px] text-foreground">
          <Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
