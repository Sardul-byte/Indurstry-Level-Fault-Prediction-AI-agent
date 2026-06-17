import React, { useState } from "react";
import { getReport } from "../../lib/api";
import { Download, Loader2 } from "lucide-react";

interface ExportButtonProps {
  investigationId: string;
}

export function ExportButton({ investigationId }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // getReport with 'markdown' returns the URL path to the download
      const downloadUrl = await getReport(investigationId, "markdown");
      
      // Trigger native browser file download (Requirement 17.2)
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.setAttribute("download", `postmortem-${investigationId}.md`);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (err) {
      console.error("Failed to export postmortem report:", err);
      alert("Failed to export markdown report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-white font-bold text-xs uppercase tracking-wider font-mono rounded-xl shadow-sm hover:shadow-md transition duration-200 disabled:opacity-50 flex items-center gap-2"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          Export Markdown
        </>
      )}
    </button>
  );
}
