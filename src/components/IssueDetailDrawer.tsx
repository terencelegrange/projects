"use client";

import { useEffect, useState } from "react";

export interface UserSummary {
  id: number;
  name: string | null;
  email: string;
  avatar: number | null;
}

export interface IssueComment {
  id: number;
  content: string;
  created_at: string;
  user: UserSummary;
}

export interface IssueData {
  id: number;
  key: string;
  issueNumber: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  type: string;
  position?: number;
  estimate: number | null;
  dueDate: string | null;
  project?: { id: number; key: string; name: string; color: string };
  assignee: UserSummary | null;
  reporter: UserSummary | null;
  comments?: IssueComment[];
  commentsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStatusOption {
  id?: number;
  key: string;
  name: string;
  color?: string | null;
  order?: number;
  is_done?: boolean;
}

export interface IssueTypeOption {
  id?: number;
  key: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string | null;
  is_default?: boolean;
}

interface IssueDetailDrawerProps {
  issueId: number | null;
  onClose: () => void;
  onUpdated: (updatedIssue: IssueData) => void;
  onDeleted: (deletedIssueId: number) => void;
  users: UserSummary[];
  statusMap?: Record<string, string>;
  projectStatuses?: ProjectStatusOption[];
  issueTypes?: IssueTypeOption[];
}

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  backlog: { label: "Backlog", bg: "bg-gray-100 dark:bg-slate-800", text: "text-gray-700 dark:text-gray-300", dot: "bg-gray-400" },
  todo: { label: "To Do", bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  in_progress: { label: "In Progress", bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  in_review: { label: "In Review", bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  done: { label: "Done", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  canceled: { label: "Canceled", bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-400" },
};

export const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  urgent: { label: "Urgent", color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800", icon: "🔴" },
  high: { label: "High", color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800", icon: "🟠" },
  medium: { label: "Medium", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800", icon: "🟡" },
  low: { label: "Low", color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800", icon: "🔵" },
  none: { label: "None", color: "text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700", icon: "⚪" },
};

export const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  task: { label: "Task", icon: "✓", color: "text-blue-500" },
  bug: { label: "Bug", icon: "🐛", color: "text-rose-500" },
  feature: { label: "Feature", icon: "✨", color: "text-emerald-500" },
  improvement: { label: "Improvement", icon: "⚡", color: "text-purple-500" },
};

export default function IssueDetailDrawer({
  issueId,
  onClose,
  onUpdated,
  onDeleted,
  users,
  statusMap = {},
  projectStatuses = [],
  issueTypes = [],
}: IssueDetailDrawerProps) {
  const [issue, setIssue] = useState<IssueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!issueId) {
      setIssue(null);
      return;
    }

    setLoading(true);
    fetch(`/api/issues/${issueId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setIssue(data);
          setTitle(data.title);
          setDescription(data.description || "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [issueId]);

  if (!issueId) return null;

  async function updateField(updates: Partial<IssueData> & Record<string, any>) {
    if (!issue) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setIssue((prev) => (prev ? { ...prev, ...data } : null));
        onUpdated(data);
      }
    } catch (e) {
      console.error("Failed to update issue:", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleTitleBlur() {
    setIsEditingTitle(false);
    if (title.trim() && title !== issue?.title) {
      await updateField({ title: title.trim() });
    }
  }

  async function handleDescriptionBlur() {
    if (description !== (issue?.description || "")) {
      await updateField({ description });
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !issue) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setIssue((prev) =>
          prev
            ? {
                ...prev,
                comments: [...(prev.comments || []), newComment],
                commentsCount: (prev.commentsCount || 0) + 1,
              }
            : null
        );
        setCommentText("");
      }
    } catch (e) {
      console.error("Failed to add comment:", e);
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleDelete() {
    if (!issue) return;
    try {
      const res = await fetch(`/api/issues/${issue.id}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted(issue.id);
        onClose();
      }
    } catch (e) {
      console.error("Failed to delete issue:", e);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end animate-fadeIn">
      {/* Backdrop click */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded">
              {issue?.key || "..."}
            </span>
            {saving && (
              <span className="text-xs text-gray-400 animate-pulse">Saving changes...</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition"
                title="Delete Issue"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/50 p-1 rounded border border-rose-200 dark:border-rose-800">
                <span className="text-xs text-rose-700 dark:text-rose-300 font-medium px-1">Delete?</span>
                <button
                  onClick={handleDelete}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                >
                  No
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : issue ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Title */}
            <div>
              {isEditingTitle ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => e.key === "Enter" && handleTitleBlur()}
                  autoFocus
                  className="w-full text-xl font-bold bg-white dark:bg-slate-800 border border-indigo-500 rounded px-3 py-1.5 text-gray-900 dark:text-white focus:outline-none"
                />
              ) : (
                <h2
                  onClick={() => setIsEditingTitle(true)}
                  className="text-xl font-bold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/60 p-2 rounded -ml-2 transition"
                >
                  {issue.title}
                </h2>
              )}
            </div>

            {/* Properties Grid */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-slate-800/40 p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              {/* Status */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1.5">
                  Status
                </label>
                <select
                  value={issue.status}
                  onChange={(e) => updateField({ status: e.target.value })}
                  className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {projectStatuses.length > 0 ? (
                    projectStatuses.map((st) => (
                      <option key={st.key} value={st.key}>
                        {st.name}
                      </option>
                    ))
                  ) : (
                    Object.entries(STATUS_CONFIG).map(([val, conf]) => (
                      <option key={val} value={val}>
                        {statusMap[val] || conf.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1.5">
                  Priority
                </label>
                <select
                  value={issue.priority}
                  onChange={(e) => updateField({ priority: e.target.value })}
                  className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(PRIORITY_CONFIG).map(([val, conf]) => (
                    <option key={val} value={val}>
                      {conf.icon} {conf.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1.5">
                  Type
                </label>
                <select
                  value={issue.type}
                  onChange={(e) => updateField({ type: e.target.value })}
                  className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {issueTypes.length > 0 ? (
                    issueTypes.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.icon || "✓"} {t.name}
                      </option>
                    ))
                  ) : (
                    Object.entries(TYPE_CONFIG).map(([val, conf]) => (
                      <option key={val} value={val}>
                        {conf.icon} {conf.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Assignee */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1.5">
                  Assignee
                </label>
                <select
                  value={issue.assignee?.id || ""}
                  onChange={(e) => updateField({ assignee_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                rows={5}
                placeholder="Add a detailed description or acceptance criteria..."
                className="w-full bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 rounded-xl p-3.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-y"
              />
            </div>

            {/* Comments & Activity Section */}
            <div className="pt-4 border-t border-gray-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span>Discussion & Comments</span>
                <span className="text-xs font-normal text-gray-400">
                  ({issue.comments?.length || 0})
                </span>
              </h3>

              {/* Comments List */}
              <div className="space-y-4 mb-6">
                {issue.comments && issue.comments.length > 0 ? (
                  issue.comments.map((c) => (
                    <div
                      key={c.id}
                      className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-gray-200/80 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">
                            {(c.user.name || c.user.email).slice(0, 1).toUpperCase()}
                          </div>
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                            {c.user.name || c.user.email}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(c.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap pl-8">
                        {c.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic py-2">
                    No comments yet. Start the conversation below.
                  </p>
                )}
              </div>

              {/* Add Comment Form */}
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !commentText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1.5"
                >
                  {submittingComment ? "Posting..." : "Comment"}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
