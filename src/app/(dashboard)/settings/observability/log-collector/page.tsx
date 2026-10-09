"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ObservabilityConfig } from "@/lib/observability";

export default function LogCollectorSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [endpoint, setEndpoint] = useState("http://192.168.100.228:8020/ingest");
  const [apiKey, setApiKey] = useState("");
  const [siteId, setSiteId] = useState("projects");
  const [logLevel, setLogLevel] = useState("info");
  const [showApiKey, setShowApiKey] = useState(false);

  const [customPayload, setCustomPayload] = useState(
    JSON.stringify(
      {
        level: "info",
        message: "Test structured log from Projects settings",
        status_code: 200,
        method: "POST",
        path: "/api/observability/test",
        service: "projects",
        metadata: {
          test: true,
          environment: "development",
        },
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    statusCode?: number;
    statusText?: string;
    latencyMs?: number;
    response?: unknown;
    error?: string;
  } | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/observability");
        if (res.ok) {
          const data: Record<string, ObservabilityConfig> = await res.json();
          if (data.logcollector) {
            setEnabled(data.logcollector.enabled);
            setEndpoint(data.logcollector.endpoint || "http://192.168.100.228:8020/ingest");
            setApiKey(data.logcollector.apiKey || "");
            setSiteId(data.logcollector.siteId || "projects");
            setLogLevel(data.logcollector.logLevel || "info");
            setCustomPayload(
              JSON.stringify(
                {
                  level: data.logcollector.logLevel || "info",
                  message: "Test structured log from Projects settings",
                  status_code: 200,
                  method: "POST",
                  path: "/api/observability/test",
                  service: data.logcollector.siteId || "projects",
                  metadata: {
                    test: true,
                    environment: "development",
                  },
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              )
            );
          }
        }
      } catch (e) {
        console.error("Failed to load LogCollector settings", e);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      const res = await fetch("/api/observability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "logcollector",
          enabled,
          endpoint,
          apiKey,
          siteId,
          logLevel,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        const err = await res.json();
        setSaveError(err.error ?? "Failed to save configuration");
      }
    } catch {
      setSaveError("Network error: Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(customPayload);
    } catch {
      setTesting(false);
      setTestResult({
        success: false,
        error: "Invalid JSON format in custom connector payload preview",
      });
      return;
    }

    try {
      const res = await fetch("/api/observability/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "logcollector",
          endpoint,
          apiKey,
          payload: parsedPayload,
        }),
      });

      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({
        success: false,
        error: "Network error: Failed to dispatch test request",
      });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mb-1">
          <Link href="/settings" className="hover:text-emerald-500 transition">Settings</Link>
          <span>/</span>
          <Link href="/settings/observability" className="hover:text-emerald-500 transition">Observability</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">Log Collector</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Log Collector Configuration</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Stream platform activity and audit events to a remote LogCollector (FastAPI / MariaDB).
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Form */}
        <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Enable Remote Log Shipping</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Automatically stream application logs and audit actions to LogCollector
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled ? "bg-emerald-500" : "bg-gray-200 dark:bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1">
                Ingest Endpoint URL
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="http://192.168.100.228:8020/ingest"
                className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                Target endpoint for <code>POST /ingest</code> HTTP log submissions.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1">
                LogCollector API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter Bearer API key"
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3.5 py-2.5 pr-10 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showApiKey ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                Transmitted as <code>Authorization: Bearer &lt;api_key&gt;</code> to authenticate with LogCollector.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1">
                  Service Identifier
                </label>
                <input
                  type="text"
                  value={siteId}
                  onChange={(e) => {
                    setSiteId(e.target.value);
                    try {
                      const parsed = JSON.parse(customPayload);
                      parsed.service = e.target.value;
                      setCustomPayload(JSON.stringify(parsed, null, 2));
                    } catch {}
                  }}
                  placeholder="projects"
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1">
                  Minimum Log Level
                </label>
                <select
                  value={logLevel}
                  onChange={(e) => {
                    setLogLevel(e.target.value);
                    try {
                      const parsed = JSON.parse(customPayload);
                      parsed.level = e.target.value;
                      setCustomPayload(JSON.stringify(parsed, null, 2));
                    } catch {}
                  }}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="debug">debug</option>
                  <option value="info">info</option>
                  <option value="warning">warning</option>
                  <option value="error">error</option>
                </select>
              </div>
            </div>
          </div>

          {saveSuccess && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Log Collector configuration saved successfully.
            </div>
          )}

          {saveError && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-xs font-medium text-red-600 dark:text-red-400">
              {saveError}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50 transition"
            >
              {saving ? "Saving Changes..." : "Save Log Collector Configuration"}
            </button>
          </div>
        </form>

        {/* Custom Connector & Test Suite */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Custom Connector & Payload Preview</h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Verify your LogCollector Bearer token authentication and test shipping an actual structured log.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1">
              Structured Log Payload
            </label>
            <textarea
              rows={9}
              value={customPayload}
              onChange={(e) => setCustomPayload(e.target.value)}
              className="w-full font-mono text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 p-3.5 text-gray-900 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition"
            >
              {testing ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Sending Log...</span>
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Test Connector</span>
                </>
              )}
            </button>
          </div>

          {/* Test Results Output */}
          {testResult && (
            <div className={`rounded-xl border p-4 text-xs space-y-2 ${
              testResult.success
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
            }`}>
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  {testResult.success ? (
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {testResult.success ? "Log Ingested Successfully" : "Log Ingestion Failed"}
                </span>
                {testResult.latencyMs != null && (
                  <span className="font-normal text-gray-500 dark:text-slate-400">
                    {testResult.latencyMs}ms
                  </span>
                )}
              </div>

              {testResult.statusCode && (
                <p><strong>HTTP Status:</strong> {testResult.statusCode} {testResult.statusText || ""}</p>
              )}

              {testResult.error && (
                <p><strong>Error:</strong> {testResult.error}</p>
              )}

              {testResult.response !== undefined && (
                <div>
                  <p className="font-semibold text-gray-700 dark:text-slate-300 mb-1">Server Response:</p>
                  <pre className="p-2 rounded bg-black/30 overflow-x-auto text-[11px]">
                    {typeof testResult.response === "object"
                      ? JSON.stringify(testResult.response, null, 2)
                      : String(testResult.response)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
