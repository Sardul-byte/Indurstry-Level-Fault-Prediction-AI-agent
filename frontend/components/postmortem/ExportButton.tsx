import React, { useState } from "react";
import { getReport } from "../../lib/api";

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
      className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm rounded-xl shadow-lg transition duration-200 disabled:opacity-50 flex items-center gap-2"
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <span>📥</span> Export Markdown
        </>
      )}
    </button>
  );
}
