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

const TEMPLATES = [
  {
    name: "Database Pool Exhaustion",
    service: "payment-service",
    env: "production",
    alert: JSON.stringify({
      event: "DATABASE_CONNECTION_POOL_EXHAUSTED",
      severity: "critical",
      service: "payment-service",
      details: {
        pool_size: 50,
        active_connections: 50,
        waiting_requests: 124
      }
    }, null, 2),
    logs: `2026-06-16T02:00:01Z [WARNING] connection pool size reached limit of 50\n2026-06-16T02:00:03Z [ERROR] failed to acquire connection to database 'payment_db' within 5000ms\n2026-06-16T02:00:05Z [CRITICAL] InternalServerError: Database connection timeout at checkout flow.\n2026-06-16T02:00:08Z [INFO] attempting automatic pool reconnection...`,
    fileName: "payment_db_exhaustion.log"
  },
  {
    name: "Redis Cache Outage",
    service: "auth-service",
    env: "staging",
    alert: JSON.stringify({
      event: "REDIS_CONNECTION_REFUSED",
      severity: "warning",
      service: "auth-service",
      details: {
        redis_host: "cache.internal.net",
        port: 6379,
        error_code: "ECONNREFUSED"
      }
    }, null, 2),
    logs: `2026-06-16T02:10:00Z [INFO] initialized auth-service on port 3000\n2026-06-16T02:10:02Z [WARNING] Redis client disconnected. Attempting to reconnect...\n2026-06-16T02:10:05Z [ERROR] Redis connection error: connect ECONNREFUSED 10.0.4.12:6379\n2026-06-16T02:10:08Z [WARNING] Serving fallback cache requests from local memory store.`,
    fileName: "redis_auth_error.log"
  },
  {
    name: "Kubernetes OOM Crash",
    service: "api-gateway",
    env: "production",
    alert: JSON.stringify({
      event: "KUBERNETES_OOM_KILLED",
      severity: "critical",
      pod: "api-gateway-7f4d9b6c-8x2z",
      exit_code: 137
    }, null, 2),
    logs: `2026-06-16T01:50:00Z [INFO] system metrics: heap_used=892MB, limit=1024MB\n2026-06-16T01:50:15Z [WARNING] Garbage collection duration exceeded 1500ms (GC overhead limit exceeded)\n2026-06-16T01:50:30Z [CRITICAL] Memory allocation of 128MB failed.\n2026-06-16T01:50:31Z [INFO] Kernel: Out of memory: Kill process 1242 (node) score 950 or sacrifice child`,
    fileName: "kubernetes_oom.log"
  }
];

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

  const loadTemplate = (tpl: typeof TEMPLATES[0]) => {
    setAlertText(tpl.alert);
    setServiceName(tpl.service);
    setEnvironment(tpl.env);
    
    // Create mock File object
    const file = new File([tpl.logs], tpl.fileName, { type: "text/plain" });
    setLogFile(file);

    // Set local timestamp
    const now = new Date();
    const formatted = now.toISOString().slice(0, 16);
    setTimestamp(formatted);

    // Reset validations
    setErrors({});
    setGlobalError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const isTxt = file.name.endsWith(".txt");
      const isJson = file.name.endsWith(".json");
      if (!isTxt && !isJson) {
        setErrors((prev) => ({ ...prev, logFile: "Only .txt or .json log files are allowed." }));
        setLogFile(null);
        return;
      }

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
      const logs = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read log file."));
        reader.readAsText(logFile!);
      });

      let alert_data: Record<string, any> = {};
      try {
        alert_data = JSON.parse(alertText);
      } catch {
        alert_data = { raw_alert_text: alertText };
      }

      const formattedTimestamp = timestamp ? new Date(timestamp).toISOString() : null;

      const response = await submitIncident({
        alert_data,
        logs,
        service_name: serviceName.trim() || null,
        environment: environment.trim() || null,
        timestamp: formattedTimestamp,
      });

      // Save to localStorage
      try {
        const list = JSON.parse(localStorage.getItem("recent_investigations") || "[]");
        const newEntry = {
          id: response.investigation_id,
          serviceName: serviceName.trim() || "unknown-service",
          environment: environment.trim() || "production",
          timestamp: formattedTimestamp || new Date().toISOString()
        };
        const updated = [newEntry, ...list.filter((x: any) => x.id !== response.investigation_id)].slice(0, 6);
        localStorage.setItem("recent_investigations", JSON.stringify(updated));
      } catch (errStorage) {
        console.error("Failed to update local history store:", errStorage);
      }

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
      className="space-y-8 max-w-3xl mx-auto bg-surface border border-border rounded-2xl p-8 md:p-10 shadow-sm transition duration-500 hover:shadow-md"
    >
      {globalError && (
        <div className="p-4 bg-danger/10 border border-danger/30 text-danger text-sm font-semibold rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Interactive Templates */}
      <div className="space-y-3 pb-6 border-b border-border">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono flex items-center gap-1.5">
          <span>⚡</span> Quick Load Incident Templates
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map((tpl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => loadTemplate(tpl)}
              className="px-4 py-3 text-left rounded-xl bg-surface border border-border hover:border-primary/40 hover:bg-surface-raised transition group flex flex-col justify-between h-full space-y-1.5"
            >
              <span className="text-xs font-bold text-foreground group-hover:text-primary transition font-mono leading-tight">
                {tpl.name}
              </span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
                {tpl.service} • {tpl.env}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Alert Text Area */}
      <div className="space-y-2.5">
        <label className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Terminal className="w-4 h-4 text-primary" />
          Alert Payload (JSON format recommended, max 10,000 characters)
        </label>
        <textarea
          rows={6}
          value={alertText}
          onChange={(e) => setAlertText(e.target.value)}
          placeholder='{"event": "HTTP_500", "path": "/checkout", "message": "Database timeout"}'
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground placeholder-subtle focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition font-mono text-sm leading-relaxed"
        />
        <div className="flex justify-between text-xs font-semibold text-muted-foreground/80">
          <span>Make sure it's valid JSON for structured agent parsing</span>
          <span className={alertText.length > 9000 ? "text-warning" : ""}>
            {alertText.length.toLocaleString()} / 10,000 chars
          </span>
        </div>
        <FieldError message={errors.alertText} />
      </div>

      {/* Log File Upload */}
      <div className="space-y-2.5">
        <label className="flex items-center gap-2 text-sm font-bold text-foreground">
          <FileCode2 className="w-4 h-4 text-primary" />
          System Server Logs (.txt or .json, max 10 MB)
        </label>
        
        <div className="relative group border border-dashed border-border hover:border-primary/40 rounded-xl bg-surface/50 hover:bg-surface-raised transition p-6 flex flex-col items-center justify-center text-center gap-2 cursor-pointer">
          <input
            type="file"
            accept=".txt,.json"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <UploadCloud className="w-10 h-10 text-muted-foreground group-hover:text-primary transition" />
          {logFile ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-primary font-mono">{logFile.name}</p>
              <p className="text-xs text-muted-foreground">{(logFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-foreground">
                Click to browse files
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Drag and drop your server logs or runbook guides
              </p>
            </div>
          )}
        </div>
        <FieldError message={errors.logFile} />
      </div>

      {/* Metadata layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-border">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-primary" />
            Service Name
          </label>
          <input
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="payment-service"
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground placeholder-subtle focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <Globe className="w-3.5 h-3.5 text-primary" />
            Environment
          </label>
          <input
            type="text"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            placeholder="production"
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground placeholder-subtle focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-primary" />
            Timestamp
          </label>
          <input
            type="datetime-local"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition text-sm"
          />
        </div>
      </div>

      {/* Submit button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm uppercase tracking-wider font-mono"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 text-white animate-spin" />
              <span>Launching Orchestration Pipeline...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-white fill-current animate-pulse" />
              <span>Launch Autonomous Triage</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
