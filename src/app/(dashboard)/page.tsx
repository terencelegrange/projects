"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STATUS_CONFIG, PRIORITY_CONFIG, TYPE_CONFIG } from "@/components/IssueDetailDrawer";

interface DashboardData {
  totalUsers: number;
  pendingUsers: number;
  totalProjects: number;
  totalIssues: number;
  inProgressIssues: number;
  doneIssues: number;
  activeProjects: {
    id: number;
    key: string;
    name: string;
    color: string;
    totalIssues: number;
    doneIssues: number;
    inProgressIssues: number;
    completionRate: number;
  }[];
  myRecentIssues: {
    id: number;
    key: string;
    title: string;
    status: string;
    priority: string;
    type: string;
    projectKey: string;
    projectName: string;
    projectColor: string;
  }[];
}

function StatTile({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`mt-2 text-3xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [issueTypes, setIssueTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOverview() {
      try {
        const [dashRes, typesRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/issue-types"),
        ]);
        if (dashRes.ok) {
          const json = await dashRes.json();
          setData(json);
        }
        if (typesRes.ok) {
          const tJson = await typesRes.json();
          setIssueTypes(tJson.issueTypes || []);
        }
      } catch (e) {
        console.error("Failed to load dashboard overview:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-2 sm:p-4">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Workspace Overview
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Real-time activity and issue status across all projects
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-500/20 transition active:scale-95"
          >
            <span>All Projects & Boards</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* Stat Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 animate-pulse space-y-2">
              <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-7 w-12 bg-gray-200 dark:bg-slate-700 rounded" />
            </div>
          ))
        ) : (
          <>
            <StatTile label="Projects" value={data?.totalProjects ?? 0} color="text-indigo-600 dark:text-indigo-400" icon="📁" />
            <StatTile label="Total Issues" value={data?.totalIssues ?? 0} color="text-gray-900 dark:text-white" icon="📋" />
            <StatTile label="In Progress" value={data?.inProgressIssues ?? 0} color="text-amber-500 dark:text-amber-400" icon="⚡" />
            <StatTile label="Resolved" value={data?.doneIssues ?? 0} color="text-emerald-500 dark:text-emerald-400" icon="✅" />
          </>
        )}
      </div>

      {/* Two Column Section: Assigned to Me & Project Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned to Me Queue */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">📌</span>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Assigned to Me</h2>
            </div>
            <span className="text-xs font-semibold text-gray-400">
              {data?.myRecentIssues?.length || 0} active
            </span>
          </div>

          <div className="p-4 flex-1 divide-y divide-gray-100 dark:divide-slate-800">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="py-3 flex items-center gap-3 animate-pulse">
                  <div className="w-16 h-4 bg-gray-200 dark:bg-slate-700 rounded" />
                  <div className="flex-1 h-4 bg-gray-200 dark:bg-slate-700 rounded" />
                </div>
              ))
            ) : !data?.myRecentIssues || data.myRecentIssues.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xs text-gray-400 italic">You have no open issues assigned.</p>
              </div>
            ) : (
              data.myRecentIssues.map((iss) => {
                const prioConf = PRIORITY_CONFIG[iss.priority] || PRIORITY_CONFIG.medium;
                const typeItem = issueTypes.find((t) => t.key === iss.type);
                const typeIcon = typeItem?.icon || TYPE_CONFIG[iss.type]?.icon || "✓";

                return (
                  <Link
                    key={iss.id}
                    href={`/projects/${iss.projectKey}`}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-slate-800/40 rounded-xl px-2.5 transition group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs">{typeIcon}</span>
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                        {iss.key}
                      </span>
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                        {iss.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${prioConf.color}`}>
                        {prioConf.label}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-gray-400">
                        {iss.projectKey}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Active Projects Hub */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🚀</span>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Active Projects</h2>
            </div>
            <Link
              href="/projects"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="p-4 flex-1 space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl animate-pulse space-y-2">
                  <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
                  <div className="h-2 w-full bg-gray-200 dark:bg-slate-700 rounded" />
                </div>
              ))
            ) : !data?.activeProjects || data.activeProjects.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xs text-gray-400 italic">No projects created yet.</p>
                <Link
                  href="/projects"
                  className="mt-2 inline-block text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                >
                  + Create your first project
                </Link>
              </div>
            ) : (
              data.activeProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.key}`}
                  className="block p-3.5 bg-gray-50 dark:bg-slate-800/40 hover:bg-indigo-50/40 dark:hover:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 transition group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400">{p.key}</span>
                      <span className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                        {p.name}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{p.completionRate}%</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${p.completionRate}%`, backgroundColor: p.color || "#6366f1" }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-semibold text-gray-400 mt-2">
                    <span>{p.totalIssues} total tasks</span>
                    <span>{p.inProgressIssues} active · {p.doneIssues} done</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
