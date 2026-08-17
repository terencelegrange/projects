"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserSummary } from "@/components/IssueDetailDrawer";

interface ProjectStats {
  total: number;
  done: number;
  in_progress: number;
  todo: number;
  backlog: number;
  completionRate: number;
}

interface ProjectData {
  id: number;
  key: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  lead: UserSummary | null;
  attributes?: { id: number; key: string; value: string }[];
  attributesMap?: Record<string, string>;
  stats: ProjectStats;
  created_at: string;
  updated_at: string;
}

const COLOR_OPTIONS = [
  "#6366f1", // Indigo
  "#3b82f6", // Blue
  "#0ea5e9", // Sky
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
  "#8b5cf6", // Purple
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserSummary[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectData | null>(null);
  const [formName, setFormName] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState(COLOR_OPTIONS[0]);
  const [formLeadId, setFormLeadId] = useState<string>("");
  const [formAttributes, setFormAttributes] = useState<{ id?: number; key: string; value: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [projRes, usersRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/users"),
      ]);

      if (projRes.ok) {
        const projData = await projRes.json();
        setProjects(projData);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || usersData || []);
      }
    } catch (e) {
      console.error("Failed to load projects:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleOpenCreate() {
    setEditingProject(null);
    setFormName("");
    setFormKey("");
    setFormDescription("");
    setFormColor(COLOR_OPTIONS[0]);
    setFormLeadId("");
    setFormAttributes([{ key: "REPO", value: "" }]);
    setFormError(null);
    setShowModal(true);
  }

  function handleOpenEdit(p: ProjectData) {
    setEditingProject(p);
    setFormName(p.name);
    setFormKey(p.key);
    setFormDescription(p.description || "");
    setFormColor(p.color || COLOR_OPTIONS[0]);
    setFormLeadId(p.lead?.id ? String(p.lead.id) : "");
    setFormAttributes(
      p.attributes && p.attributes.length > 0
        ? p.attributes.map((a) => ({ id: a.id, key: a.key, value: a.value }))
        : [{ key: "REPO", value: "" }]
    );
    setFormError(null);
    setShowModal(true);
  }

  function handleAddAttribute(presetKey?: string) {
    setFormAttributes((prev) => [...prev, { key: presetKey || "", value: "" }]);
  }

  function handleRemoveAttribute(idx: number) {
    setFormAttributes((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAttributeChange(idx: number, field: "key" | "value", val: string) {
    setFormAttributes((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        [field]: field === "key" ? val.toUpperCase().replace(/[^A-Z0-9_]/g, "") : val,
      };
      return next;
    });
  }

  function handleNameChange(val: string) {
    setFormName(val);
    if (!editingProject && (!formKey || formKey === formName.slice(0, 4).toUpperCase())) {
      const autoKey = val.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "");
      setFormKey(autoKey);
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Project name is required");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const cleanedAttributes = formAttributes
        .filter((a) => a.key.trim() && a.value.trim())
        .map((a) => ({ key: a.key.trim(), value: a.value.trim() }));

      if (editingProject) {
        // PATCH
        const res = await fetch(`/api/projects/${editingProject.key}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDescription.trim() || null,
            color: formColor,
            lead_id: formLeadId ? Number(formLeadId) : null,
            attributes: cleanedAttributes,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update project");
      } else {
        // POST
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: formKey.trim().toUpperCase(),
            name: formName.trim(),
            description: formDescription.trim() || undefined,
            color: formColor,
            lead_id: formLeadId ? Number(formLeadId) : undefined,
            attributes: cleanedAttributes,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create project");
      }

      await loadData();
      setShowModal(false);
    } catch (err: any) {
      setFormError(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(key: string) {
    if (!confirm(`Are you sure you want to delete project ${key} and all its issues?`)) return;
    try {
      const res = await fetch(`/api/projects/${key}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.key !== key));
      }
    } catch (e) {
      console.error("Failed to delete project:", e);
    }
  }

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.key.toLowerCase().includes(search.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Projects & Workspaces
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage product roadmaps, Kanban boards, and issue backlogs across your teams.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm shadow-indigo-500/20 transition active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Project
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search projects by name, key or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
            📁
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">No projects found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            {search ? "No projects match your search query." : "Get started by creating your first project to organize tasks."}
          </p>
          {!search && (
            <button
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
            >
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 rounded-2xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between group"
            >
              <div>
                {/* Top bar with color pill & key */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-slate-700">
                      {p.key}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
                      title="Edit project"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(p.key)}
                      className="p-1 text-gray-400 hover:text-rose-500 rounded"
                      title="Delete project"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Name & Description */}
                <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                  <Link href={`/projects/${p.key}`}>{p.name}</Link>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2 min-h-[32px]">
                  {p.description || "No description provided."}
                </p>

                {/* Progress bar */}
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-gray-600 dark:text-gray-400">Progress</span>
                    <span className="font-bold text-gray-900 dark:text-white">{p.stats.completionRate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${p.stats.completionRate}%`,
                        backgroundColor: p.color || "#6366f1",
                      }}
                    />
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                  <div className="bg-gray-50 dark:bg-slate-800/60 p-2 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Total</div>
                    <div className="text-sm font-extrabold text-gray-900 dark:text-white mt-0.5">{p.stats.total}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 p-2 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Todo</div>
                    <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">{p.stats.todo}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 p-2 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Active</div>
                    <div className="text-sm font-extrabold text-amber-500 dark:text-amber-400 mt-0.5">{p.stats.in_progress}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-800/60 p-2 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Done</div>
                    <div className="text-sm font-extrabold text-emerald-500 dark:text-emerald-400 mt-0.5">{p.stats.done}</div>
                  </div>
                </div>
                {/* Attributes Badges (e.g. REPO, DOCS) */}
                {p.attributes && p.attributes.length > 0 && (
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    {p.attributes.map((attr) => {
                      const isUrl = /^https?:\/\//i.test(attr.value);
                      return (
                        <a
                          key={attr.id}
                          href={isUrl ? attr.value : undefined}
                          target={isUrl ? "_blank" : undefined}
                          rel={isUrl ? "noopener noreferrer" : undefined}
                          onClick={(e) => {
                            if (!isUrl) e.preventDefault();
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium transition ${
                            isUrl
                              ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200/80 dark:border-indigo-800"
                              : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                          }`}
                          title={`${attr.key}: ${attr.value}`}
                        >
                          <span className="font-bold">{attr.key}:</span>
                          <span className="truncate max-w-[120px]">{attr.value}</span>
                          {isUrl && <span className="text-[9px]">↗</span>}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {p.lead && (
                    <div
                      className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center"
                      title={`Lead: ${p.lead.name || p.lead.email}`}
                    >
                      {(p.lead.name || p.lead.email).slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[110px]">
                    {p.lead ? (p.lead.name || p.lead.email.split("@")[0]) : "No lead"}
                  </span>
                </div>

                <Link
                  href={`/projects/${p.key}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  Open Board →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-scaleUp">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingProject ? `Edit ${editingProject.key}` : "Create New Project"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Project Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mobile App Redesign"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {!editingProject && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Project Key <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="e.g. APP"
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    className="w-full font-mono uppercase bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Used as issue prefix (e.g. {formKey || "APP"}-1, {formKey || "APP"}-2).
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Goals and scope of this project..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Accent Color
                </label>
                <div className="flex items-center gap-2 pt-1">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormColor(c)}
                      className={`w-7 h-7 rounded-full transition transform ${
                        formColor === c ? "scale-110 ring-2 ring-offset-2 ring-indigo-500" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Project Lead
                </label>
                <select
                  value={formLeadId}
                  onChange={(e) => setFormLeadId(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a team member (optional)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Variables & Attributes Section */}
              <div className="pt-2 border-t border-gray-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Variables &amp; Attributes
                    </label>
                    <p className="text-[11px] text-gray-400">
                      Configure custom variables like REPO URL, DOCS, CI/CD, etc.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddAttribute()}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <span>+ Add Variable</span>
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <span className="text-[11px] text-gray-400">Presets:</span>
                  {["REPO", "DOCS", "WEBSITE", "CI_CD", "SLACK"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddAttribute(preset)}
                      className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-[10px] font-mono font-semibold text-gray-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-200 dark:border-slate-700 transition"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>

                {/* Attribute Rows */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {formAttributes.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-1">No custom attributes configured.</p>
                  ) : (
                    formAttributes.map((attr, idx) => {
                      const isUrl = /^https?:\/\//i.test(attr.value);
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="KEY (e.g. REPO)"
                            value={attr.key}
                            onChange={(e) => handleAttributeChange(idx, "key", e.target.value)}
                            className="w-32 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <div className="flex-1 relative">
                            <input
                              type="text"
                              placeholder="Value / URL (e.g. http://192.168.100.252:3000/...)"
                              value={attr.value}
                              onChange={(e) => handleAttributeChange(idx, "value", e.target.value)}
                              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {isUrl && (
                              <a
                                href={attr.value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute right-2 top-1.5 text-indigo-500 hover:text-indigo-700 text-xs"
                                title="Open URL in new tab"
                              >
                                ↗
                              </a>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttribute(idx)}
                            className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg transition"
                            title="Remove attribute"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
                >
                  {submitting ? "Saving..." : editingProject ? "Save Changes" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
