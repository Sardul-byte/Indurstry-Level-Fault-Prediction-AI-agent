import React, { useState } from "react";
import { submitIncident, ApiError } from "../../lib/api";
import { FieldError } from "./FieldError";
import { 
  Terminal, 
  FileCode2, 
  Layers, 
  Globe, 
  Clock, 
  AlertTriangle, 
  Play, 
  Loader2,
  UploadCloud
} from "lucide-react";

interface IncidentFormProps {
  onSuccess: (investigationId: string) => void;
}

export function IncidentForm({ onSuccess }: IncidentFormProps) {
  const [alertText, setAlertText] = useState("");
  const [logFile, setLogFile] = useState<File | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [environment, setEnvironment] = useState("");
  const [timestamp, setTimestamp] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      // Validate extension (Requirement 14.1: .txt or .json only)
      const isTxt = file.name.endsWith(".txt");
      const isJson = file.name.endsWith(".json");
      if (!isTxt && !isJson) {
        setErrors((prev) => ({ ...prev, logFile: "Only .txt or .json log files are allowed." }));
        setLogFile(null);
        return;
      }

      // Validate size (Requirement 14.1: max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setErrors((prev) => ({ ...prev, logFile: "Log file size exceeds the 10 MB limit." }));
        setLogFile(null);
        return;
      }

      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.logFile;
        return copy;
      });
      setLogFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setGlobalError(null);

    const validationErrors: Record<string, string> = {};

    // Validate alert length (Requirement 14.1: max 10k chars)
    if (!alertText.trim()) {
      validationErrors.alertText = "Alert payload is required.";
    } else if (alertText.length > 10000) {
      validationErrors.alertText = "Alert payload exceeds the 10,000 characters limit.";
    }

    if (!logFile) {
      validationErrors.logFile = "Log file is required.";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      // 1. Read file content as text
      const logs = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read log file."));
        reader.readAsText(logFile!);
      });

      // 2. Parse alert payload
      let alert_data: Record<string, any> = {};
      try {
        alert_data = JSON.parse(alertText);
      } catch {
        // If not valid JSON, wrap it as a dictionary string (FastAPI endpoint expects dict)
        alert_data = { raw_alert_text: alertText };
      }

      // 3. Format timestamp to ISO 8601
      const formattedTimestamp = timestamp ? new Date(timestamp).toISOString() : null;

      // 4. API Submit call
      const response = await submitIncident({
        alert_data,
        logs,
        service_name: serviceName.trim() || null,
        environment: environment.trim() || null,
        timestamp: formattedTimestamp,
      });

      onSuccess(response.investigation_id);
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const errorMsg = err.message;
          setGlobalError("Submission failed due to schema validation errors.");
          setErrors((prev) => ({
            ...prev,
            alertText: errorMsg.includes("alert_data") ? "Invalid alert schema." : "",
            logFile: errorMsg.includes("logs") ? "Invalid log contents." : "",
          }));
        } else {
          setGlobalError(`Incident submission failed: ${err.message} (Request ID: ${err.request_id})`);
        }
      } else {
        setGlobalError(err?.message || "Failed to submit incident. Please check your internet connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="space-y-8 max-w-3xl mx-auto glass-panel rounded-2xl p-8 md:p-10 shadow-2xl transition duration-500 hover:shadow-cyan-950/10"
    >
      {globalError && (
        <div className="p-4 bg-red-950/20 border border-red-900/50 text-red-400 text-sm font-semibold rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Alert Text Area */}
      <div className="space-y-2.5">
        <label className="flex items-center gap-2 text-sm font-bold text-slate-300">
          <Terminal className="w-4 h-4 text-cyan-400" />
          Alert Payload (JSON format recommended, max 10,000 characters)
        </label>
        <textarea
          rows={6}
          value={alertText}
          onChange={(e) => setAlertText(e.target.value)}
          placeholder='{"event": "HTTP_500", "path": "/checkout", "message": "Database timeout"}'
          className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition font-mono text-sm leading-relaxed"
        />
        <div className="flex justify-between text-xs font-semibold text-slate-600">
          <span>Make sure it's valid JSON for structured agent parsing</span>
          <span className={alertText.length > 9000 ? "text-amber-500" : ""}>
            {alertText.length.toLocaleString()} / 10,000 chars
          </span>
        </div>
        <FieldError message={errors.alertText} />
      </div>

      {/* Log File Upload */}
      <div className="space-y-2.5">
        <label className="flex items-center gap-2 text-sm font-bold text-slate-300">
          <FileCode2 className="w-4 h-4 text-cyan-400" />
          System Server Logs (.txt or .json, max 10 MB)
        </label>
        
        <div className="relative group border border-dashed border-slate-800 hover:border-cyan-500/40 rounded-xl bg-slate-950/50 hover:bg-slate-950/80 transition p-6 flex flex-col items-center justify-center text-center gap-2 cursor-pointer">
          <input
            type="file"
            accept=".txt,.json"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <UploadCloud className="w-10 h-10 text-slate-500 group-hover:text-cyan-400 transition" />
          {logFile ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-cyan-400 font-mono">{logFile.name}</p>
              <p className="text-xs text-slate-500">{(logFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-slate-300">
                Click to browse files
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Drag and drop your server logs or runbook guides
              </p>
            </div>
          )}
        </div>
        <FieldError message={errors.logFile} />
      </div>

      {/* Metadata layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-900">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-cyan-500" />
            Service Name
          </label>
          <input
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="payment-service"
            className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Globe className="w-3.5 h-3.5 text-cyan-500" />
            Environment
          </label>
          <input
            type="text"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            placeholder="production"
            className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-cyan-500" />
            Timestamp
          </label>
          <input
            type="datetime-local"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition text-sm"
          />
        </div>
      </div>

      {/* Submit button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:via-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 text-white animate-spin" />
              <span>Launching Orchestration Pipeline...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-white fill-current" />
              <span>Launch Autonomous Triage</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
