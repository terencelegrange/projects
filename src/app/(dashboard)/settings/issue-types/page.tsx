"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getIssueTypeStyle } from "@/lib/issueTypes";

interface IssueTypeItem {
  id: number;
  key: string;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  is_default: boolean;
  issuesCount?: number;
}

const ICON_PRESETS = [
  { icon: "✓", label: "Check / Task" },
  { icon: "🐛", label: "Bug / Defect" },
  { icon: "✨", label: "Sparkles / Feature" },
  { icon: "⚡", label: "Lightning / Improvement" },
  { icon: "🚀", label: "Rocket / Epic / Release" },
  { icon: "🎯", label: "Target / Goal / Milestone" },
  { icon: "🔥", label: "Fire / Urgent / Incident" },
  { icon: "🛡️", label: "Shield / Security / Compliance" },
  { icon: "📌", label: "Pin / Initiative" },
  { icon: "💡", label: "Lightbulb / Idea" },
  { icon: "🔧", label: "Wrench / Maintenance / Chore" },
  { icon: "📦", label: "Package / Dependency" },
  { icon: "🧪", label: "Flask / Experiment / Spike" },
  { icon: "📝", label: "Memo / Documentation" },
  { icon: "🚨", label: "Siren / Critical Alert" },
  { icon: "🎨", label: "Palette / Design / UI" },
];

const COLOR_PRESETS = [
  { label: "Blue", value: "#3b82f6" },
  { label: "Emerald / Green", value: "#10b981" },
  { label: "Amber / Orange", value: "#f59e0b" },
  { label: "Purple", value: "#a855f7" },
  { label: "Rose / Red", value: "#ef4444" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Slate / Gray", value: "#94a3b8" },
];

export default function IssueTypesSettingsPage() {
  const [issueTypes, setIssueTypes] = useState<IssueTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal State for Add / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<IssueTypeItem | null>(null);
  const [modalName, setModalName] = useState("");
  const [modalKey, setModalKey] = useState("");
  const [modalIcon, setModalIcon] = useState("✓");
  const [modalColor, setModalColor] = useState(COLOR_PRESETS[0].value);
  const [modalDescription, setModalDescription] = useState("");
  const [modalIsDefault, setModalIsDefault] = useState(false);

  // Delete Modal State
  const [deletingType, setDeletingType] = useState<IssueTypeItem | null>(null);
  const [migrateTargetKey, setMigrateTargetKey] = useState("");

  async function loadIssueTypes() {
    setLoading(true);
    try {
      const res = await fetch("/api/issue-types");
      if (res.ok) {
        const data = await res.json();
        setIssueTypes(data.issueTypes || []);
      }
    } catch (e) {
      console.error("Failed to load issue types:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIssueTypes();
  }, []);

  function handleOpenAdd() {
    setEditingType(null);
    setModalName("");
    setModalKey("");
    setModalIcon("✓");
    setModalColor(COLOR_PRESETS[0].value);
    setModalDescription("");
    setModalIsDefault(false);
    setShowModal(true);
    setSuccessMsg(null);
    setErrorMsg(null);
  }

  function handleOpenEdit(item: IssueTypeItem) {
    setEditingType(item);
    setModalName(item.name);
    setModalKey(item.key);
    setModalIcon(item.icon || "✓");
    setModalColor(item.color || COLOR_PRESETS[0].value);
    setModalDescription(item.description || "");
    setModalIsDefault(item.is_default);
    setShowModal(true);
    setSuccessMsg(null);
    setErrorMsg(null);
  }

  async function handleSaveType(e: React.FormEvent) {
    e.preventDefault();
    if (!modalName.trim()) return;

    setBusy(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      if (editingType) {
        // Update existing type
        const res = await fetch(`/api/issue-types/${editingType.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: modalName.trim(),
            key: modalKey.trim() || undefined,
            icon: modalIcon.trim() || "✓",
            color: modalColor,
            description: modalDescription.trim() || null,
            is_default: modalIsDefault,
          }),
        });

        if (res.ok) {
          setSuccessMsg(`Issue type "${modalName}" updated successfully.`);
          setShowModal(false);
          await loadIssueTypes();
        } else {
          const d = await res.json();
          setErrorMsg(d.error || "Failed to update issue type.");
        }
      } else {
        // Create new issue type
        const res = await fetch("/api/issue-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: modalName.trim(),
            key: modalKey.trim() || undefined,
            icon: modalIcon.trim() || "✓",
            color: modalColor,
            description: modalDescription.trim() || null,
            is_default: modalIsDefault,
          }),
        });

        if (res.ok) {
          setSuccessMsg(`Issue type "${modalName}" created successfully.`);
          setShowModal(false);
          await loadIssueTypes();
        } else {
          const d = await res.json();
          setErrorMsg(d.error || "Failed to create issue type.");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  }

  function handleOpenDelete(item: IssueTypeItem) {
    if (issueTypes.length <= 1) {
      alert("You must keep at least one issue type.");
      return;
    }
    const other = issueTypes.find((t) => t.id !== item.id);
    setMigrateTargetKey(other?.key || "task");
    setDeletingType(item);
  }

  async function handleConfirmDelete() {
    if (!deletingType) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/issue-types/${deletingType.id}?migrateToKey=${encodeURIComponent(migrateTargetKey)}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(
          `Issue type "${deletingType.name}" deleted. (${data.migratedCount || 0} issues migrated to "${migrateTargetKey}")`
        );
        setDeletingType(null);
        await loadIssueTypes();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Failed to delete issue type.");
      }
    } catch (e) {
      console.error("Failed to delete issue type:", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
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
              Issue Types
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 pl-8">
            Manage issue categories, custom icons, labels, and default types across projects (Task, Bug, Feature, Epic, Spike...).
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          disabled={busy || loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-500/20 transition active:scale-95 self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Issue Type
        </button>
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

      {/* Main Issue Types Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/60 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300 flex items-center gap-2">
            <span>🏷️</span>
            <span>Configured Issue Types ({issueTypes.length})</span>
          </h2>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 dark:bg-slate-800 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="w-40 h-4 bg-gray-200 dark:bg-slate-800 rounded" />
                  <div className="w-64 h-3 bg-gray-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
            ))
          ) : issueTypes.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400">
              No issue types found. Click &ldquo;Add Issue Type&rdquo; above to create one.
            </div>
          ) : (
            issueTypes.map((item) => {
              const style = getIssueTypeStyle(item.color);

              return (
                <div
                  key={item.id}
                  className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-start sm:items-center gap-4">
                    {/* Icon Badge */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border flex-shrink-0 ${style.bg} ${style.border}`}
                    >
                      {item.icon}
                    </div>

                    {/* Name + Key + Description */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {item.name}
                        </span>

                        <code className="text-[11px] font-mono text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          key: {item.key}
                        </code>

                        {item.is_default && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-full">
                            Default Type
                          </span>
                        )}

                        <span
                          className="w-3 h-3 rounded-full border border-gray-200 dark:border-slate-700"
                          style={{ backgroundColor: item.color }}
                          title={`Color: ${item.color}`}
                        />
                      </div>

                      {item.description && (
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Issues Count & Actions */}
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className="text-xs text-gray-400 px-2.5 py-1 bg-gray-100 dark:bg-slate-800 rounded-lg">
                      {item.issuesCount || 0} issues
                    </span>

                    <button
                      onClick={() => handleOpenEdit(item)}
                      disabled={busy}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 transition"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleOpenDelete(item)}
                      disabled={busy || issueTypes.length <= 1}
                      className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition disabled:opacity-30"
                      title="Delete issue type"
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {editingType ? `Edit Issue Type: ${editingType.name}` : "Add New Issue Type"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveType} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Type Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Task, Bug, Feature, Epic, Spike"
                  value={modalName}
                  onChange={(e) => {
                    setModalName(e.target.value);
                    if (!editingType && !modalKey) {
                      setModalKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, "_"));
                    }
                  }}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Unique Key */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Unique Key
                </label>
                <input
                  type="text"
                  placeholder="e.g. task, bug, epic, spike"
                  value={modalKey}
                  onChange={(e) => setModalKey(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Used by REST APIs. Auto-generated from name if omitted.
                </p>
              </div>

              {/* Icon / Emoji Picker */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                  Icon / Symbol
                </label>
                <div className="grid grid-cols-8 gap-2 mb-2">
                  {ICON_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.icon}
                      onClick={() => setModalIcon(p.icon)}
                      className={`h-9 rounded-xl flex items-center justify-center text-base border transition ${
                        modalIcon === p.icon
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 scale-105 shadow-sm"
                          : "border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800"
                      }`}
                      title={p.label}
                    >
                      {p.icon}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Custom Symbol:</span>
                  <input
                    type="text"
                    maxLength={10}
                    value={modalIcon}
                    onChange={(e) => setModalIcon(e.target.value)}
                    className="w-20 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-center text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
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

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Large initiative containing multiple user stories"
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Is Default Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="modalIsDefault"
                  checked={modalIsDefault}
                  onChange={(e) => setModalIsDefault(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="modalIsDefault" className="text-xs font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">
                  Set as default issue type for newly raised issues
                </label>
              </div>

              {/* Modal Actions */}
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
                  {busy ? "Saving..." : editingType ? "Update Issue Type" : "Create Issue Type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Migration Confirmation Modal */}
      {deletingType && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>⚠️</span>
              <span>Delete Issue Type: &ldquo;{deletingType.name}&rdquo;?</span>
            </h3>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Any issues currently assigned to <strong>{deletingType.name}</strong> will be safely reassigned to your chosen destination type:
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                Reassign Existing Issues To:
              </label>
              <select
                value={migrateTargetKey}
                onChange={(e) => setMigrateTargetKey(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {issueTypes
                  .filter((t) => t.id !== deletingType.id)
                  .map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.icon} {t.name} ({t.key})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingType(null)}
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
