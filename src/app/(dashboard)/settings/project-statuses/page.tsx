"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStatusStyle } from "@/lib/projectStatuses";

interface ProjectSummary {
  id: number;
  key: string;
  name: string;
  color: string;
}

interface StatusItem {
  id: number;
  project_id: number;
  key: string;
  name: string;
  order: number;
  color: string | null;
  is_done: boolean;
  notify_on_enter: boolean;
  issueCount?: number;
}

const COLOR_PRESETS = [
  { label: "Slate / Gray", value: "#94a3b8" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Amber / Yellow", value: "#f59e0b" },
  { label: "Purple", value: "#a855f7" },
  { label: "Emerald / Green", value: "#10b981" },
  { label: "Rose / Red", value: "#ef4444" },
];

export default function ProjectStatusesSettingsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>("");
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal State for Add / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingStatus, setEditingStatus] = useState<StatusItem | null>(null);
  const [modalName, setModalName] = useState("");
  const [modalKey, setModalKey] = useState("");
  const [modalColor, setModalColor] = useState(COLOR_PRESETS[0].value);
  const [modalIsDone, setModalIsDone] = useState(false);
  const [modalNotify, setModalNotify] = useState(false);

  // Delete Modal with Issue Migration
  const [deletingStatus, setDeletingStatus] = useState<StatusItem | null>(null);
  const [migrateTargetKey, setMigrateTargetKey] = useState("");

  // Load all projects
  async function loadProjects() {
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data || []);
        if (data.length > 0 && !selectedProjectKey) {
          setSelectedProjectKey(data[0].key);
        }
      }
    } catch (e) {
      console.error("Failed to load projects:", e);
    } finally {
      setLoadingProjects(false);
    }
  }

  // Load statuses for selected project
  async function loadStatuses(projectKey: string) {
    if (!projectKey) return;
    setLoadingStatuses(true);
    try {
      const res = await fetch(`/api/projects/${projectKey}/statuses`);
      if (res.ok) {
        const data = await res.json();
        setStatuses(data.statuses || []);
      }
    } catch (e) {
      console.error("Failed to load project statuses:", e);
    } finally {
      setLoadingStatuses(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectKey) {
      loadStatuses(selectedProjectKey);
    }
  }, [selectedProjectKey]);

  function handleOpenAdd() {
    setEditingStatus(null);
    setModalName("");
    setModalKey("");
    setModalColor(COLOR_PRESETS[1].value);
    setModalIsDone(false);
    setModalNotify(false);
    setShowModal(true);
    setSuccessMsg(null);
    setErrorMsg(null);
  }

  function handleOpenEdit(st: StatusItem) {
    setEditingStatus(st);
    setModalName(st.name);
    setModalKey(st.key);
    setModalColor(st.color || COLOR_PRESETS[0].value);
    setModalIsDone(st.is_done);
    setModalNotify(st.notify_on_enter);
    setShowModal(true);
    setSuccessMsg(null);
    setErrorMsg(null);
  }

  async function handleSaveStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectKey || !modalName.trim()) return;

    setBusy(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      if (editingStatus) {
        // Update existing status
        const res = await fetch(`/api/projects/${selectedProjectKey}/statuses/${editingStatus.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: modalName.trim(),
            key: modalKey.trim() || undefined,
            color: modalColor,
            is_done: modalIsDone,
            notify_on_enter: modalNotify,
          }),
        });

        if (res.ok) {
          setSuccessMsg(`Status stage "${modalName}" successfully updated.`);
          setShowModal(false);
          await loadStatuses(selectedProjectKey);
        } else {
          const d = await res.json();
          setErrorMsg(d.error || "Failed to update status.");
        }
      } else {
        // Create new status stage
        const res = await fetch(`/api/projects/${selectedProjectKey}/statuses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: modalName.trim(),
            key: modalKey.trim() || undefined,
            color: modalColor,
            is_done: modalIsDone,
            notify_on_enter: modalNotify,
          }),
        });

        if (res.ok) {
          setSuccessMsg(`New workflow stage "${modalName}" added to project.`);
          setShowModal(false);
          await loadStatuses(selectedProjectKey);
        } else {
          const d = await res.json();
          setErrorMsg(d.error || "Failed to create status.");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  }

  // Move status Up (swap with previous index)
  async function handleMoveUp(index: number) {
    if (index <= 0) return;
    const newStatuses = [...statuses];
    const temp = newStatuses[index - 1];
    newStatuses[index - 1] = newStatuses[index];
    newStatuses[index] = temp;

    setStatuses(newStatuses);
    await persistOrder(newStatuses);
  }

  // Move status Down (swap with next index)
  async function handleMoveDown(index: number) {
    if (index >= statuses.length - 1) return;
    const newStatuses = [...statuses];
    const temp = newStatuses[index + 1];
    newStatuses[index + 1] = newStatuses[index];
    newStatuses[index] = temp;

    setStatuses(newStatuses);
    await persistOrder(newStatuses);
  }

  async function persistOrder(orderedList: StatusItem[]) {
    if (!selectedProjectKey) return;
    setBusy(true);
    try {
      const statusIds = orderedList.map((s) => s.id);
      const res = await fetch(`/api/projects/${selectedProjectKey}/statuses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusIds }),
      });

      if (res.ok) {
        const data = await res.json();
        setStatuses(data.statuses || orderedList);
        setSuccessMsg("Workflow stage order updated.");
      }
    } catch (e) {
      console.error("Failed to reorder statuses:", e);
      loadStatuses(selectedProjectKey);
    } finally {
      setBusy(false);
    }
  }

  function handleOpenDelete(st: StatusItem) {
    if (statuses.length <= 1) {
      alert("A project must have at least one status stage.");
      return;
    }
    const other = statuses.find((s) => s.id !== st.id);
    setMigrateTargetKey(other?.key || "");
    setDeletingStatus(st);
  }

  async function handleConfirmDelete() {
    if (!deletingStatus || !selectedProjectKey) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${selectedProjectKey}/statuses/${deletingStatus.id}?migrateToKey=${encodeURIComponent(
          migrateTargetKey
        )}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setSuccessMsg(`Status stage "${deletingStatus.name}" deleted.`);
        setDeletingStatus(null);
        await loadStatuses(selectedProjectKey);
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Failed to delete status.");
      }
    } catch (e) {
      console.error("Failed to delete status:", e);
    } finally {
      setBusy(false);
    }
  }

  const selectedProject = projects.find((p) => p.key === selectedProjectKey);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
              Project Statuses & Workflows
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 pl-8">
            Configure custom stages and sequential <strong>1 to N ordering</strong> per board. Each project can have its own independent workflow columns.
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Project Board:
          </label>
          <select
            value={selectedProjectKey}
            onChange={(e) => setSelectedProjectKey(e.target.value)}
            disabled={loadingProjects || busy}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            {projects.map((p) => (
              <option key={p.key} value={p.key}>
                {p.key} — {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert Banners */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}

      {/* Main Statuses Manager Card */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {selectedProject && (
              <span
                className="w-3.5 h-3.5 rounded-full"
                style={{ backgroundColor: selectedProject.color }}
              />
            )}
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300">
              {selectedProject ? `${selectedProject.name} (${statuses.length} Stages)` : "Workflow Stages"}
            </h2>
          </div>

          <button
            onClick={handleOpenAdd}
            disabled={busy || loadingStatuses}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Stage
          </button>
        </div>

        {/* Statuses List */}
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {loadingStatuses ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-4 bg-gray-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
            ))
          ) : statuses.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400">
              No custom workflow statuses configured for this project.
            </div>
          ) : (
            statuses.map((st, idx) => {
              const style = getStatusStyle(st.color);
              const isFirst = idx === 0;
              const isLast = idx === statuses.length - 1;

              return (
                <div
                  key={st.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition"
                >
                  {/* Order Rank & Visual Pill */}
                  <div className="flex items-center gap-3">
                    {/* Numeric Order Badge */}
                    <span className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-mono text-xs font-bold flex items-center justify-center border border-gray-200 dark:border-slate-700">
                      {idx + 1}
                    </span>

                    {/* Up / Down buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMoveUp(idx)}
                        disabled={isFirst || busy}
                        className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-20 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition text-[10px]"
                        title="Move column left / up in priority"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveDown(idx)}
                        disabled={isLast || busy}
                        className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-20 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition text-[10px]"
                        title="Move column right / down in priority"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Status Pill & Meta */}
                    <div className="flex items-center gap-3 ml-1">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${style.bg} ${style.text} ${style.border}`}>
                        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                        {st.name}
                      </span>

                      <code className="text-[11px] font-mono text-gray-400 bg-gray-100 dark:bg-slate-800/80 px-2 py-0.5 rounded">
                        key: {st.key}
                      </code>

                      {st.is_done && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full">
                          Completed Stage
                        </span>
                      )}

                      {st.notify_on_enter && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-full">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                          </svg>
                          Notifies
                        </span>
                      )}

                      {isFirst && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-full">
                          Default on Creation
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleOpenEdit(st)}
                      disabled={busy}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleOpenDelete(st)}
                      disabled={busy || statuses.length <= 1}
                      className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition disabled:opacity-30"
                      title="Delete status"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Live Mini Kanban Column Preview */}
      <div className="bg-slate-100 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-400 flex items-center gap-2">
            <span>📊</span>
            <span>Live Kanban Board Column Preview</span>
          </h3>
          <span className="text-[11px] text-gray-400">
            {statuses.length} Columns from Left to Right
          </span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 pt-1">
          {statuses.map((st, i) => {
            const style = getStatusStyle(st.color);
            return (
              <div
                key={st.id}
                className="w-48 flex-shrink-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {st.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 dark:bg-slate-900 px-1 rounded">
                    #{i + 1}
                  </span>
                </div>
                <div className="h-14 border border-dashed border-gray-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-[10px] text-gray-400">
                  Cards in {st.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {editingStatus ? `Edit Stage: ${editingStatus.name}` : "Add New Workflow Stage"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStatus} className="space-y-4">
              {/* Stage Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Stage Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Idea, In Review, QA, Deployed"
                  value={modalName}
                  onChange={(e) => {
                    setModalName(e.target.value);
                    if (!editingStatus && !modalKey) {
                      setModalKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, "_"));
                    }
                  }}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Unique Key */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Unique Status Key
                </label>
                <input
                  type="text"
                  placeholder="e.g. idea, in_qa, deployed"
                  value={modalKey}
                  onChange={(e) => setModalKey(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Used by REST APIs. Auto-generated from name if omitted.
                </p>
              </div>

              {/* Color Accent */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Color Accent
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      type="button"
                      key={c.value}
                      onClick={() => setModalColor(c.value)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition ${
                        modalColor === c.value
                          ? "border-indigo-600 scale-110 shadow-sm"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    >
                      {modalColor === c.value && (
                        <span className="text-white text-xs font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Is Completed Stage Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="modalIsDone"
                  checked={modalIsDone}
                  onChange={(e) => setModalIsDone(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="modalIsDone" className="text-xs font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">
                  Mark as Completed / Shipped stage (counts toward 100% completion rate)
                </label>
              </div>

              {/* Notify on Enter Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="modalNotify"
                  checked={modalNotify}
                  onChange={(e) => setModalNotify(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="modalNotify" className="text-xs font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">
                  Notify me when an issue moves into this stage (shown in the bell, top right)
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !modalName.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition"
                >
                  {busy ? "Saving..." : editingStatus ? "Update Stage" : "Create Stage"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Migration Confirmation Modal */}
      {deletingStatus && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>⚠️</span>
              <span>Delete Stage: &ldquo;{deletingStatus.name}&rdquo;?</span>
            </h3>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Any issues currently residing in <strong>{deletingStatus.name}</strong> will be safely moved to your chosen destination stage:
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                Move Existing Issues To:
              </label>
              <select
                value={migrateTargetKey}
                onChange={(e) => setMigrateTargetKey(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {statuses
                  .filter((s) => s.id !== deletingStatus.id)
                  .map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name} ({s.key})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingStatus(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={busy}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                {busy ? "Deleting..." : "Confirm & Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
