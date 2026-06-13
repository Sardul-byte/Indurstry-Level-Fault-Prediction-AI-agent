import React, { useState } from "react";
import { submitIncident, ApiError } from "../../lib/api";
import { FieldError } from "./FieldError";

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
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          // Display inline field validation errors (Requirement 14.3)
          // Look inside validation error array if present
          const errorMsg = err.message;
          setGlobalError("Submission failed due to schema validation errors.");
          setErrors((prev) => ({
            ...prev,
            alertText: errorMsg.includes("alert_data") ? "Invalid alert schema." : "",
            logFile: errorMsg.includes("logs") ? "Invalid log contents." : "",
          }));
        } else {
          // General HTTP error banner (Requirement 14.4)
          setGlobalError(`Incident submission failed: ${err.message} (Request ID: ${err.request_id})`);
        }
      } else {
        setGlobalError("Failed to submit incident. Please check your internet connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl transition duration-500 hover:shadow-cyan-950/20">
      
      {globalError && (
        <div className="p-4 bg-red-950/30 border border-red-950/70 text-red-400 text-sm font-medium rounded-xl animate-shake">
          {globalError}
        </div>
      )}

      {/* Alert Text Area */}
      <div>
        <label className="block text-sm font-semibold text-slate-200 mb-2">
          Alert Data (JSON or plain text, max 10,000 characters)
        </label>
        <textarea
          rows={5}
          value={alertText}
          onChange={(e) => setAlertText(e.target.value)}
          placeholder="Paste Alert message or JSON payload here..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{alertText.length} / 10,000 characters</span>
        </div>
        <FieldError message={errors.alertText} />
      </div>

      {/* Log File Upload */}
      <div>
        <label className="block text-sm font-semibold text-slate-200 mb-2">
          Logs File (.txt or .json, max 10 MB)
        </label>
        <input
          type="file"
          accept=".txt,.json"
          onChange={handleFileChange}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-950 file:text-cyan-400 hover:file:bg-cyan-900 cursor-pointer"
        />
        <FieldError message={errors.logFile} />
      </div>

      {/* Optional metadata fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-2">
            Service Name (Optional)
          </label>
          <input
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="payment-service"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-2">
            Environment (Optional)
          </label>
          <input
            type="text"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            placeholder="production"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-2">
            Timestamp (Optional)
          </label>
          <input
            type="datetime-local"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
          />
        </div>
      </div>

      {/* Submit button */}
      <div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Initializing Investigation..." : "Launch Incident Investigation"}
        </button>
      </div>

    </form>
  );
}
