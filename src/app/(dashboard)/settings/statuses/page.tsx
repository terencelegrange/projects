"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StatusItem {
  key: string;
  defaultLabel: string;
  label: string;
  dot: string;
  bg: string;
  text: string;
  description?: string;
}

export default function CustomStatusesPage() {
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadStatuses() {
    setLoading(true);
    try {
      const res = await fetch("/api/statuses");
      if (res.ok) {
        const data = await res.json();
        setStatuses(data.statuses || []);
        const labels: Record<string, string> = {};
        for (const s of data.statuses || []) {
          labels[s.key] = s.label === s.defaultLabel ? "" : s.label;
        }
        setCustomLabels(labels);
      }
    } catch (e) {
      console.error("Failed to load statuses:", e);
      setErrorMsg("Failed to load statuses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatuses();
  }, []);

  function handleLabelChange(key: string, value: string) {
    setCustomLabels((prev) => ({ ...prev, [key]: value }));
    setSuccessMsg(null);
  }

  function handleResetSingle(key: string) {
    setCustomLabels((prev) => ({ ...prev, [key]: "" }));
    setSuccessMsg(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const mappings: Record<string, string> = {};
      for (const s of statuses) {
        const val = customLabels[s.key]?.trim();
        mappings[s.key] = val || s.defaultLabel;
      }

      const res = await fetch("/api/statuses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });

      if (res.ok) {
        setSuccessMsg("Status mappings successfully saved! Changes apply across Kanban boards, filters, and APIs.");
        await loadStatuses();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Failed to save status mappings.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetAll() {
    if (!confirm("Are you sure you want to reset all custom status labels back to system defaults?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/statuses", { method: "DELETE" });
      if (res.ok) {
        setSuccessMsg("All status mappings have been reset to system defaults.");
        await loadStatuses();
      }
    } catch {
      setErrorMsg("Failed to reset statuses.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              title="Back to Settings"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Custom Status Mappings
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 pl-8">
            Customize workflow status display names (e.g. rename <strong>Backlog</strong> to <em>&ldquo;Feature Ideation&rdquo;</em>). Unconfigured statuses fall back to system defaults.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetAll}
          disabled={saving || loading}
          className="text-xs font-semibold text-gray-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-rose-300 transition self-start sm:self-auto"
        >
          Reset All to Defaults
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs flex items-center gap-2">
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-2xl text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/60 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300">
              Workflow Statuses Configuration
            </h2>
            <span className="text-xs text-gray-400">
              6 Standard Workflow Stages
            </span>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-5 flex items-center gap-4 animate-pulse">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="w-32 h-4 bg-gray-200 dark:bg-slate-800 rounded" />
                    <div className="w-48 h-3 bg-gray-100 dark:bg-slate-800/50 rounded" />
                  </div>
                </div>
              ))
            ) : (
              statuses.map((s) => {
                const customVal = customLabels[s.key] ?? "";
                const effectiveLabel = customVal.trim() || s.defaultLabel;
                const isCustomized = customVal.trim() !== "" && customVal.trim() !== s.defaultLabel;

                return (
                  <div
                    key={s.key}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition"
                  >
                    {/* Status Meta */}
                    <div className="min-w-[200px] flex items-start gap-3">
                      <span className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${s.dot}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {s.defaultLabel}
                          </span>
                          <code className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {s.key}
                          </code>
                        </div>
                        {s.description && (
                          <p className="text-xs text-gray-400 mt-0.5 max-w-xs">
                            {s.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Custom Label Input & Live Preview */}
                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder={`Default: "${s.defaultLabel}"`}
                          value={customVal}
                          onChange={(e) => handleLabelChange(s.key, e.target.value)}
                          className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {isCustomized && (
                          <button
                            type="button"
                            onClick={() => handleResetSingle(s.key)}
                            className="absolute right-2.5 top-2 text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-200 dark:bg-slate-700 px-1.5 py-0.5 rounded"
                            title="Reset to default label"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      {/* Live Badge Preview */}
                      <div className="flex items-center gap-2 min-w-[150px]">
                        <span className="text-[10px] uppercase font-bold text-gray-400">
                          Preview:
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border border-transparent ${s.bg} ${s.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {effectiveLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Save */}
          <div className="px-6 py-4 bg-gray-50/80 dark:bg-slate-800/60 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Leave blank to use system default name.
            </p>
            <button
              type="submit"
              disabled={saving || loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm shadow-indigo-500/20 transition active:scale-95"
            >
              {saving ? "Saving Changes..." : "Save Custom Statuses"}
            </button>
          </div>
        </div>
      </form>

      {/* Programmatic API Usage Note */}
      <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-5 text-xs text-indigo-950 dark:text-indigo-200 space-y-2">
        <h3 className="font-bold text-sm text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
          <span>⚡</span>
          <span>Programmatic API Access</span>
        </h3>
        <p className="leading-relaxed">
          Custom status mappings can also be read and updated programmatically by 3rd-party bots and workflows using the REST API:
        </p>
        <div className="bg-slate-900 text-gray-200 p-3 rounded-xl font-mono text-[11px] space-y-1">
          <div><span className="text-emerald-400 font-bold">GET</span> /api/statuses — Fetch current active labels and dictionary</div>
          <div><span className="text-amber-400 font-bold">PUT</span> /api/statuses — Update label mappings: <code className="text-indigo-300">&#123; &quot;mappings&quot;: &#123; &quot;backlog&quot;: &quot;Feature Ideation&quot; &#125; &#125;</code></div>
        </div>
      </div>
    </div>
  );
}
