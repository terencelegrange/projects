"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import IssueDetailDrawer, {
  IssueData,
  UserSummary,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  TYPE_CONFIG,
} from "@/components/IssueDetailDrawer";
import NewIssueModal from "@/components/NewIssueModal";

const KANBAN_COLUMNS = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "in_review", title: "In Review" },
  { id: "done", title: "Done" },
];

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 5,
  high: 4,
  medium: 3,
  low: 2,
  none: 1,
};

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectKey = (params?.key as string)?.toUpperCase();

  const [project, setProject] = useState<any>(null);
  const [issues, setIssues] = useState<IssueData[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode: board | list
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  // Filters
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Drawers / Modals
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newModalDefaultStatus, setNewModalDefaultStatus] = useState("todo");

  // Drag & Drop State
  const [draggingIssueId, setDraggingIssueId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverIssueId, setDragOverIssueId] = useState<number | null>(null);
  const [dropPlacement, setDropPlacement] = useState<"above" | "below" | null>(null);

  async function loadData() {
    if (!projectKey) return;
    try {
      const [projRes, issuesRes, usersRes] = await Promise.all([
        fetch(`/api/projects/${projectKey}`),
        fetch(`/api/projects/${projectKey}/issues`),
        fetch("/api/users"),
      ]);

      if (projRes.ok) {
        const projData = await projRes.json();
        setProject(projData);
      } else if (projRes.status === 404) {
        router.push("/projects");
        return;
      }

      if (issuesRes.ok) {
        const issuesData = await issuesRes.json();
        setIssues(issuesData.issues || []);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || usersData || []);
      }
    } catch (e) {
      console.error("Failed to load project workspace:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [projectKey]);

  // Handle status update (quick select)
  async function handleStatusChange(issueId: number, newStatus: string) {
    setIssues((prev) =>
      prev.map((iss) => (iss.id === issueId ? { ...iss, status: newStatus } : iss))
    );

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setIssues((prev) =>
          prev.map((iss) => (iss.id === issueId ? { ...iss, ...updated } : iss))
        );
      }
    } catch (e) {
      console.error("Failed to update status:", e);
      loadData();
    }
  }

  // Handle priority update (quick select or list view)
  async function handlePriorityChange(issueId: number, newPriority: string) {
    setIssues((prev) =>
      prev.map((iss) => (iss.id === issueId ? { ...iss, priority: newPriority } : iss))
    );

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
      if (res.ok) {
        const updated = await res.json();
        setIssues((prev) =>
          prev.map((iss) => (iss.id === issueId ? { ...iss, ...updated } : iss))
        );
      }
    } catch (e) {
      console.error("Failed to update priority:", e);
    }
  }

  // Handle Drag & Drop to adjust both Column Status and Vertical Priority / Position
  async function handleDropCard(
    draggedId: number,
    targetIssueId: number | null,
    placement: "above" | "below" | "column",
    targetColId: string
  ) {
    setDragOverColumn(null);
    setDragOverIssueId(null);
    setDropPlacement(null);
    setDraggingIssueId(null);

    if (draggedId === targetIssueId && placement !== "column") return;

    const draggedIssue = issues.find((i) => i.id === draggedId);
    if (!draggedIssue) return;

    // Get sorted issues in target column
    const colIssues = issues
      .filter((i) => i.status === targetColId && i.id !== draggedId)
      .sort((a, b) => {
        const pDiff = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
        if (pDiff !== 0) return pDiff;
        return (a.position || 0) - (b.position || 0);
      });

    let newPriority = draggedIssue.priority;
    let newPosition = draggedIssue.position || 0;

    if (placement === "column" || !targetIssueId) {
      if (colIssues.length === 0) {
        newPosition = 0;
      } else {
        // Dropped at bottom of column
        const last = colIssues[colIssues.length - 1];
        newPriority = last.priority;
        newPosition = (last.position || 0) + 1;
      }
    } else {
      const targetIdx = colIssues.findIndex((i) => i.id === targetIssueId);
      const targetIssue = colIssues[targetIdx];

      if (targetIssue) {
        if (placement === "above") {
          if (targetIdx === 0) {
            // Dropped above top card -> Promoted to highest priority (urgent)!
            newPriority = "urgent";
            newPosition = (targetIssue.position || 0) - 1;
          } else {
            const prevIssue = colIssues[targetIdx - 1];
            // Match target issue priority, position before it
            newPriority = targetIssue.priority;
            newPosition = ((prevIssue.position || 0) + (targetIssue.position || 0)) / 2;
            if (newPosition === targetIssue.position) {
              newPosition = (targetIssue.position || 0) - 0.5;
            }
          }
        } else {
          // Below targetIssue
          if (targetIdx === colIssues.length - 1) {
            newPriority = targetIssue.priority;
            newPosition = (targetIssue.position || 0) + 1;
          } else {
            const nextIssue = colIssues[targetIdx + 1];
            newPriority = targetIssue.priority;
            newPosition = ((targetIssue.position || 0) + (nextIssue.position || 0)) / 2;
            if (newPosition === targetIssue.position) {
              newPosition = (targetIssue.position || 0) + 0.5;
            }
          }
        }
      }
    }

    // Optimistically update
    setIssues((prev) =>
      prev.map((iss) =>
        iss.id === draggedId
          ? { ...iss, status: targetColId, priority: newPriority, position: newPosition }
          : iss
      )
    );

    try {
      const res = await fetch(`/api/issues/${draggedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetColId,
          priority: newPriority,
          position: newPosition,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setIssues((prev) =>
          prev.map((iss) => (iss.id === draggedId ? { ...iss, ...updated } : iss))
        );
      }
    } catch (e) {
      console.error("Failed to reorder card:", e);
      loadData();
    }
  }

  // Filtered Issues
  const filteredIssues = useMemo(() => {
    return issues.filter((iss) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = iss.title.toLowerCase().includes(q);
        const matchesKey = iss.key.toLowerCase().includes(q);
        const matchesDesc = iss.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesKey && !matchesDesc) return false;
      }

      if (priorityFilter !== "all" && iss.priority !== priorityFilter) {
        return false;
      }

      if (typeFilter !== "all" && iss.type !== typeFilter) {
        return false;
      }

      if (assigneeFilter !== "all") {
        if (assigneeFilter === "unassigned") {
          if (iss.assignee !== null) return false;
        } else {
          if (String(iss.assignee?.id) !== assigneeFilter) return false;
        }
      }

      return true;
    });
  }, [issues, search, priorityFilter, typeFilter, assigneeFilter]);

  // Drag and Drop handlers
  function handleDragStart(e: React.DragEvent, issueId: number) {
    setDraggingIssueId(issueId);
    e.dataTransfer.setData("text/plain", String(issueId));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleCardDragOver(e: React.DragEvent, targetId: number) {
    e.preventDefault();
    e.stopPropagation();
    if (draggingIssueId === targetId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const placement = y < rect.height / 2 ? "above" : "below";

    setDragOverIssueId(targetId);
    setDropPlacement(placement);
  }

  function handleColumnDragOver(e: React.DragEvent, columnId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  }

  function handleColumnDrop(e: React.DragEvent, columnId: string) {
    e.preventDefault();
    e.stopPropagation();
    const idStr = e.dataTransfer.getData("text/plain");
    const issueId = Number(idStr) || draggingIssueId;
    if (issueId) {
      if (dragOverIssueId) {
        handleDropCard(issueId, dragOverIssueId, dropPlacement || "above", columnId);
      } else {
        handleDropCard(issueId, null, "column", columnId);
      }
    }
  }

  function handleOpenCreate(columnStatus: string = "todo") {
    setNewModalDefaultStatus(columnStatus);
    setShowNewModal(true);
  }

  function handleIssueUpdated(updated: IssueData) {
    setIssues((prev) =>
      prev.map((iss) => (iss.id === updated.id ? { ...iss, ...updated } : iss))
    );
  }

  function handleIssueDeleted(deletedId: number) {
    setIssues((prev) => prev.filter((iss) => iss.id !== deletedId));
  }

  function handleIssueCreated(created: IssueData) {
    setIssues((prev) => [created, ...prev]);
  }

  const hasActiveFilters =
    search.trim() !== "" ||
    priorityFilter !== "all" ||
    typeFilter !== "all" ||
    assigneeFilter !== "all";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Workspace Top Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/projects"
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
              title="Back to all projects"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>

            <div className="flex items-center gap-2.5">
              <span
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: project?.color || "#6366f1" }}
              />
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-slate-700">
                {projectKey}
              </span>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {project?.name || projectKey}
              </h1>
            </div>
          </div>

          {/* Top Actions: View Toggle + Create Issue */}
          <div className="flex items-center gap-3">
            {/* View Switcher */}
            <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode("board")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === "board"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Board
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === "list"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                List
              </button>
            </div>

            {/* Create Issue */}
            <button
              onClick={() => handleOpenCreate("todo")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-500/20 transition active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Issue
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-slate-800">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <input
              type="text"
              placeholder="Search issues..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>

          {/* Type */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none"
          >
            <option value="all">All Types</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>

          {/* Assignee */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none"
          >
            <option value="all">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name || u.email}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearch("");
                setPriorityFilter("all");
                setTypeFilter("all");
                setAssigneeFilter("all");
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              Reset Filters
            </button>
          )}

          <div className="ml-auto flex items-center gap-2 text-xs text-gray-400 font-medium">
            <span className="hidden sm:inline text-indigo-500 dark:text-indigo-400">
              💡 Drag cards vertically to set priority order (top card = highest priority)
            </span>
            <span>•</span>
            <span>Showing {filteredIssues.length} of {issues.length}</span>
          </div>
        </div>
      </div>

      {/* Main Workspace View Content */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : viewMode === "board" ? (
          /* ========================================================================= */
          /* KANBAN BOARD VIEW */
          /* ========================================================================= */
          <div className="flex gap-4 min-w-[1100px] h-full items-start pb-6">
            {KANBAN_COLUMNS.map((col) => {
              const colIssues = filteredIssues
                .filter((i) => i.status === col.id)
                .sort((a, b) => {
                  const pDiff = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
                  if (pDiff !== 0) return pDiff;
                  return (a.position || 0) - (b.position || 0);
                });

              const conf = STATUS_CONFIG[col.id] || STATUS_CONFIG.todo;
              const isOver = dragOverColumn === col.id;

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleColumnDragOver(e, col.id)}
                  onDrop={(e) => handleColumnDrop(e, col.id)}
                  className={`w-72 flex-shrink-0 flex flex-col bg-slate-100 dark:bg-slate-900/60 rounded-2xl border transition-colors max-h-full ${
                    isOver
                      ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20"
                      : "border-gray-200/80 dark:border-slate-800"
                  }`}
                >
                  {/* Column Header / Drop Target */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverColumn(col.id);
                      if (colIssues.length > 0) {
                        setDragOverIssueId(colIssues[0].id);
                        setDropPlacement("above");
                      }
                    }}
                    className="p-3.5 flex items-center justify-between border-b border-gray-200/60 dark:border-slate-800/80"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${conf.dot}`} />
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        {col.title}
                      </span>
                      <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                        {colIssues.length}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenCreate(col.id)}
                      className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded transition"
                      title={`Add issue to ${col.title}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>

                  {/* Cards Container */}
                  <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5 min-h-[150px]">
                    {colIssues.length === 0 ? (
                      <div
                        onDragOver={(e) => handleColumnDragOver(e, col.id)}
                        className="h-28 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-xs text-gray-400 gap-1"
                      >
                        <span>Drop cards here</span>
                        <span className="text-[10px] text-gray-400">or click + to add</span>
                      </div>
                    ) : (
                      colIssues.map((iss) => {
                        const prioConf = PRIORITY_CONFIG[iss.priority] || PRIORITY_CONFIG.medium;
                        const typeConf = TYPE_CONFIG[iss.type] || TYPE_CONFIG.task;
                        const isCardDragOver = dragOverIssueId === iss.id;

                        return (
                          <div
                            key={iss.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, iss.id)}
                            onDragOver={(e) => handleCardDragOver(e, iss.id)}
                            onClick={() => setSelectedIssueId(iss.id)}
                            className={`bg-white dark:bg-slate-800 border rounded-xl p-3.5 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition group select-none relative ${
                              isCardDragOver && dropPlacement === "above"
                                ? "border-t-4 border-t-indigo-500 border-gray-200 dark:border-slate-700 ring-2 ring-indigo-500/20"
                                : isCardDragOver && dropPlacement === "below"
                                ? "border-b-4 border-b-indigo-500 border-gray-200 dark:border-slate-700 ring-2 ring-indigo-500/20"
                                : "border-gray-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500"
                            }`}
                          >
                            {/* Card Top: Key + Type + Quick Priority Selector */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs" title={`Type: ${typeConf.label}`}>
                                  {typeConf.icon}
                                </span>
                                <span className="font-mono text-[11px] font-bold text-gray-500 dark:text-gray-400">
                                  {iss.key}
                                </span>
                              </div>

                              {/* Priority Badge with 1-Click Dropdown */}
                              <div className="relative group/prio" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={iss.priority}
                                  onChange={(e) => handlePriorityChange(iss.id, e.target.value)}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 ${prioConf.color}`}
                                  title="Change priority (reorders card)"
                                >
                                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Card Title */}
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                              {iss.title}
                            </h4>

                            {/* Card Footer: Assignee + Comments + Quick Move */}
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-700/60 text-xs text-gray-400">
                              <div className="flex items-center gap-1.5">
                                {iss.assignee ? (
                                  <div
                                    className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold flex items-center justify-center"
                                    title={`Assigned to: ${iss.assignee.name || iss.assignee.email}`}
                                  >
                                    {(iss.assignee.name || iss.assignee.email).slice(0, 1).toUpperCase()}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-gray-400 italic">Unassigned</span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {Number(iss.commentsCount) > 0 && (
                                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                    💬 {iss.commentsCount}
                                  </span>
                                )}

                                {/* Quick Move status dropdown */}
                                <select
                                  value={iss.status}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(iss.id, e.target.value);
                                  }}
                                  className="bg-transparent text-[11px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer focus:outline-none"
                                >
                                  {KANBAN_COLUMNS.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      → {c.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ========================================================================= */
          /* LIST VIEW */
          /* ========================================================================= */
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-500 dark:text-gray-400 uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12">Type</th>
                    <th className="py-3 px-4 w-24">Key</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4 w-32">Status</th>
                    <th className="py-3 px-4 w-28">Priority</th>
                    <th className="py-3 px-4 w-36">Assignee</th>
                    <th className="py-3 px-4 w-28">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {filteredIssues.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        No issues found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredIssues
                      .slice()
                      .sort((a, b) => (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0))
                      .map((iss) => {
                        const prioConf = PRIORITY_CONFIG[iss.priority] || PRIORITY_CONFIG.medium;
                        const typeConf = TYPE_CONFIG[iss.type] || TYPE_CONFIG.task;
                        const statusConf = STATUS_CONFIG[iss.status] || STATUS_CONFIG.todo;

                        return (
                          <tr
                            key={iss.id}
                            onClick={() => setSelectedIssueId(iss.id)}
                            className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition"
                          >
                            <td className="py-3 px-4" title={typeConf.label}>
                              <span className="text-sm">{typeConf.icon}</span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-gray-500 dark:text-gray-400">
                              {iss.key}
                            </td>
                            <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                              <div className="flex items-center gap-2">
                                <span className="hover:text-indigo-600 dark:hover:text-indigo-400">
                                  {iss.title}
                                </span>
                                {Number(iss.commentsCount) > 0 && (
                                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                    💬 {iss.commentsCount}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={iss.status}
                                onChange={(e) => handleStatusChange(iss.id, e.target.value)}
                                className={`text-[11px] font-bold px-2 py-1 rounded-lg border border-transparent appearance-none cursor-pointer focus:outline-none ${statusConf.bg} ${statusConf.text}`}
                              >
                                {KANBAN_COLUMNS.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.title}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={iss.priority}
                                onChange={(e) => handlePriorityChange(iss.id, e.target.value)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border appearance-none cursor-pointer focus:outline-none ${prioConf.color}`}
                              >
                                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                              {iss.assignee ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold flex items-center justify-center">
                                    {(iss.assignee.name || iss.assignee.email).slice(0, 1).toUpperCase()}
                                  </div>
                                  <span className="truncate max-w-[100px]">
                                    {iss.assignee.name || iss.assignee.email}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">Unassigned</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-gray-400">
                              {new Date(iss.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Detail Drawer */}
      <IssueDetailDrawer
        issueId={selectedIssueId}
        onClose={() => setSelectedIssueId(null)}
        onUpdated={handleIssueUpdated}
        onDeleted={handleIssueDeleted}
        users={users}
      />

      {/* New Issue Modal */}
      {project && (
        <NewIssueModal
          isOpen={showNewModal}
          onClose={() => setShowNewModal(false)}
          onCreated={handleIssueCreated}
          projectKey={project.key}
          defaultStatus={newModalDefaultStatus}
          users={users}
        />
      )}
    </div>
  );
}
