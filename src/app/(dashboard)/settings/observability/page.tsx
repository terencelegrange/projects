"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ObservabilityConfig } from "@/lib/observability";

export default function ObservabilitySettingsHubPage() {
  const [configs, setConfigs] = useState<Record<string, ObservabilityConfig>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadConfigs() {
      try {
        const res = await fetch("/api/observability");
        if (res.ok) {
          const data = await res.json();
          setConfigs(data);
        }
      } catch (e) {
        console.error("Failed to load observability settings", e);
      } finally {
        setLoading(false);
      }
    }
    loadConfigs();
  }, []);

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mb-1">
          <Link href="/settings" className="hover:text-emerald-500 transition">Settings</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">Observability</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Observability & Telemetry</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Configure telemetry connectors, pageview analytics, and remote log shipping.
        </p>
      </div>

      {/* Two Observability Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Analytics Tile */}
        <Link
          href="/settings/observability/analytics"
          className="group bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-105 transition">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              {loading ? (
                <div className="h-5 w-16 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
              ) : configs.analytics?.enabled ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700">
                  Disabled
                </span>
              )}
            </div>

            <div className="mt-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-emerald-500 transition">
                Analytics
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                Send pageviews, client-side route changes, and custom telemetry events to your self-hosted Analytics service (e.g. <code>http://192.168.100.228:8030</code>).
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
            <span className="truncate max-w-[200px]">
              {configs.analytics?.endpoint || "http://192.168.100.228:8030/api/collect"}
            </span>
            <span className="text-emerald-500 font-semibold group-hover:translate-x-0.5 transition inline-flex items-center gap-1">
              Configure &rarr;
            </span>
          </div>
        </Link>

        {/* Log Collector Tile */}
        <Link
          href="/settings/observability/log-collector"
          className="group bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-105 transition">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              {loading ? (
                <div className="h-5 w-16 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
              ) : configs.logcollector?.enabled ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700">
                  Disabled
                </span>
              )}
            </div>

            <div className="mt-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-emerald-500 transition">
                Log Collector
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                Stream structured application and audit logs to your LogCollector instance (e.g. <code>http://192.168.100.228:8020/ingest</code>) with Bearer token authentication.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
            <span className="truncate max-w-[200px]">
              {configs.logcollector?.endpoint || "http://192.168.100.228:8020/ingest"}
            </span>
            <span className="text-emerald-500 font-semibold group-hover:translate-x-0.5 transition inline-flex items-center gap-1">
              Configure &rarr;
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
