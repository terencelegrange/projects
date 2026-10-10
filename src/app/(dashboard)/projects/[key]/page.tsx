"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import IssueDetailDrawer, {
  IssueData,
  UserSummary,
  PRIORITY_CONFIG,
  TYPE_CONFIG,
  ProjectStatusOption,
  IssueTypeOption,
} from "@/components/IssueDetailDrawer";
import NewIssueModal from "@/components/NewIssueModal";
import { getStatusStyle } from "@/lib/projectStatusStyles";

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
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatusOption[]>([]);
  const [issueTypes, setIssueTypes] = useState<IssueTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // View Mode: board | list
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Drawers / Modals
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newModalDefaultStatus, setNewModalDefaultStatus] = useState("backlog");
  const [showAttributesModal, setShowAttributesModal] = useState(false);
  const [savingAttribute, setSavingAttribute] = useState(false);
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrVal, setNewAttrVal] = useState("");

  // Drag & Drop State
  const [draggingIssueId, setDraggingIssueId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverIssueId, setDragOverIssueId] = useState<number | null>(null);
  const [dropPlacement, setDropPlacement] = useState<"above" | "below" | null>(null);

  async function loadData() {
    if (!projectKey) return;
    try {
      const [projRes, issuesRes, usersRes, statusesRes, typesRes] = await Promise.all([
        fetch(`/api/projects/${projectKey}`),
        fetch(`/api/projects/${projectKey}/issues`),
        fetch("/api/users"),
        fetch(`/api/projects/${projectKey}/statuses`),
        fetch("/api/issue-types"),
      ]);

      if (projRes.ok) {
        const projData = await projRes.json();
        setProject(projData);
        if (projData.statuses && projData.statuses.length > 0) {
          setProjectStatuses(projData.statuses);
          setNewModalDefaultStatus(projData.statuses[0].key);
        }
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

      if (statusesRes.ok) {
        const stData = await statusesRes.json();
        if (stData.statuses && stData.statuses.length > 0) {
          setProjectStatuses(stData.statuses);
          setNewModalDefaultStatus(stData.statuses[0].key);
        }
      }

      if (typesRes.ok) {
        const tData = await typesRes.json();
        if (tData.issueTypes && tData.issueTypes.length > 0) {
          setIssueTypes(tData.issueTypes);
        }
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

  // Real-time EventSource listener for ticket changes, status movements, creations, deletions
  useEffect(() => {
    if (!projectKey) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isSubscribed = true;

    function handleEventPayload(data: any) {
      if (!isSubscribed || !data || !data.event) return;
      const eventType = data.event;
      const issue = data.issue;
      if (!issue) return;

      if (eventType === "issue.status_changed" || eventType === "issue.updated") {
        setIssues((prev) => {
          const exists = prev.some((i) => i.id === issue.id || i.key === issue.key);
          if (!exists) {
            const newCard: IssueData = {
              id: issue.id,
              key: issue.key,
              issueNumber: issue.issue_number || issue.issueNumber || 0,
              title: issue.title,
              description: issue.description || null,
              status: issue.status,
              priority: issue.priority,
              type: issue.type,
              position: issue.position ?? 0,
              estimate: issue.estimate ?? null,
              dueDate: issue.due_date || issue.dueDate || null,
              assignee: issue.assignee || null,
              reporter: issue.reporter || null,
              commentsCount: issue.commentsCount || 0,
              createdAt: issue.createdAt || new Date().toISOString(),
              updatedAt: issue.updatedAt || new Date().toISOString(),
            };
            return [newCard, ...prev];
          }
          return prev.map((item) => {
            if (item.id === issue.id || item.key === issue.key) {
              return {
                ...item,
                title: issue.title ?? item.title,
                description: issue.description !== undefined ? issue.description : item.description,
                status: issue.status ?? item.status,
                priority: issue.priority ?? item.priority,
                type: issue.type ?? item.type,
                position: issue.position !== undefined ? issue.position : item.position,
                estimate: issue.estimate !== undefined ? issue.estimate : item.estimate,
                dueDate: issue.due_date !== undefined ? issue.due_date : (issue.dueDate !== undefined ? issue.dueDate : item.dueDate),
                assignee: issue.assignee !== undefined ? issue.assignee : item.assignee,
                reporter: issue.reporter !== undefined ? issue.reporter : item.reporter,
                commentsCount: issue.commentsCount !== undefined ? issue.commentsCount : item.commentsCount,
                updatedAt: issue.updatedAt || new Date().toISOString(),
              };
            }
            return item;
          });
        });
      } else if (eventType === "issue.created") {
        setIssues((prev) => {
          const exists = prev.some((i) => i.id === issue.id || i.key === issue.key);
          if (exists) return prev;
          const newCard: IssueData = {
            id: issue.id,
            key: issue.key,
            issueNumber: issue.issue_number || issue.issueNumber || 0,
            title: issue.title,
            description: issue.description || null,
            status: issue.status,
            priority: issue.priority,
            type: issue.type,
            position: issue.position ?? 0,
            estimate: issue.estimate ?? null,
            dueDate: issue.due_date || issue.dueDate || null,
            assignee: issue.assignee || null,
            reporter: issue.reporter || null,
            commentsCount: issue.commentsCount || 0,
            createdAt: issue.createdAt || new Date().toISOString(),
            updatedAt: issue.updatedAt || new Date().toISOString(),
          };
          return [newCard, ...prev];
        });
      } else if (eventType === "issue.deleted") {
        setIssues((prev) => prev.filter((i) => i.id !== issue.id && i.key !== issue.key));
        if (selectedIssueId === issue.id) {
          setSelectedIssueId(null);
        }
      } else if (eventType === "comment.created") {
        setIssues((prev) =>
          prev.map((item) =>
            item.id === issue.id || item.key === issue.key
              ? { ...item, commentsCount: (item.commentsCount || 0) + 1 }
              : item
          )
        );
      }
    }

    function connectSSE() {
      if (!isSubscribed) return;
      try {
        eventSource = new EventSource(`/api/events/stream?projectKey=${encodeURIComponent(projectKey)}`);

        eventSource.onopen = () => {
          if (isSubscribed) setIsLiveConnected(true);
        };

        const onEventMessage = (e: MessageEvent) => {
          try {
            const parsed = JSON.parse(e.data);
            handleEventPayload(parsed);
          } catch {
            // Heartbeat comment or non-json message
          }
        };

        eventSource.addEventListener("issue.status_changed", onEventMessage);
        eventSource.addEventListener("issue.updated", onEventMessage);
        eventSource.addEventListener("issue.created", onEventMessage);
        eventSource.addEventListener("issue.deleted", onEventMessage);
        eventSource.addEventListener("comment.created", onEventMessage);
        eventSource.onmessage = onEventMessage;

        eventSource.onerror = () => {
          if (isSubscribed) {
            setIsLiveConnected(false);
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
            reconnectTimeout = setTimeout(() => {
              if (isSubscribed) connectSSE();
            }, 3000);
          }
        };
      } catch (err) {
        console.error("SSE connection setup error:", err);
        setIsLiveConnected(false);
      }
    }

    connectSSE();

    return () => {
      isSubscribed = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      setIsLiveConnected(false);
    };
  }, [projectKey, selectedIssueId]);

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

      if (statusFilter !== "all" && iss.status !== statusFilter) {
        return false;
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
  }, [issues, search, statusFilter, priorityFilter, typeFilter, assigneeFilter]);

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

  function handleOpenCreate(columnStatus?: string) {
    const targetStatus = columnStatus || projectStatuses[0]?.key || "backlog";
    setNewModalDefaultStatus(targetStatus);
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
    statusFilter !== "all" ||
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

              {/* Real-time live status indicator */}
              {isLiveConnected ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 transition"
                  title="Live sync active: listening for card changes and status movements"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 transition"
                  title="Connecting to real-time event stream..."
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Syncing
                </span>
              )}
            </div>

            {/* Quick link to Project Status Settings */}
            <Link
              href="/settings/project-statuses"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              title="Configure project workflow stages & columns"
            >
              ⚙️ Stages ({projectStatuses.length})
            </Link>

            {/* Quick button to Project Attributes / Variables */}
            <button
              onClick={() => setShowAttributesModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition"
              title="View and configure project variables & attributes (e.g. REPO)"
            >
              🏷️ Variables {project?.attributes?.length ? `(${project.attributes.length})` : ""}
            </button>

            {/* Render top attribute links (e.g. REPO, DOCS) */}
            {project?.attributes && project.attributes.length > 0 && (
              <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-gray-200 dark:border-slate-800">
                {project.attributes.slice(0, 3).map((attr: any) => {
                  const isUrl = /^https?:\/\//i.test(attr.value);
                  return (
                    <a
                      key={attr.id}
                      href={isUrl ? attr.value : undefined}
                      target={isUrl ? "_blank" : undefined}
                      rel={isUrl ? "noopener noreferrer" : undefined}
                      onClick={(e) => {
                        if (!isUrl) {
                          e.preventDefault();
                          setShowAttributesModal(true);
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium transition ${
                        isUrl
                          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200/80 dark:border-indigo-800"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                      }`}
                      title={`${attr.key}: ${attr.value}`}
                    >
                      <span className="font-bold">{attr.key}</span>
                      {isUrl && <span className="text-[9px]">↗</span>}
                    </a>
                  );
                })}
              </div>
            )}
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
              onClick={() => handleOpenCreate()}
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

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 focus:outline-none"
          >
            <option value="all">All Stages ({projectStatuses.length})</option>
            {projectStatuses.map((st) => (
              <option key={st.key} value={st.key}>
                {st.name}
              </option>
            ))}
          </select>

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
            {issueTypes.length > 0 ? (
              issueTypes.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.icon || "✓"} {t.name}
                </option>
              ))
            ) : (
              Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))
            )}
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
                setStatusFilter("all");
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
          /* DYNAMIC KANBAN BOARD VIEW (1 to N Columns) */
          /* ========================================================================= */
          <div className="flex gap-4 min-w-[1100px] h-full items-start pb-6">
            {projectStatuses.map((col) => {
              const colIssues = filteredIssues
                .filter((i) => i.status === col.key)
                .sort((a, b) => {
                  const pDiff = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
                  if (pDiff !== 0) return pDiff;
                  return (a.position || 0) - (b.position || 0);
                });

              const style = getStatusStyle(col.color);
              const isOver = dragOverColumn === col.key;

              return (
                <div
                  key={col.key}
                  onDragOver={(e) => handleColumnDragOver(e, col.key)}
                  onDrop={(e) => handleColumnDrop(e, col.key)}
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
                      setDragOverColumn(col.key);
                      if (colIssues.length > 0) {
                        setDragOverIssueId(colIssues[0].id);
                        setDropPlacement("above");
                      }
                    }}
                    className="p-3.5 flex items-center justify-between border-b border-gray-200/60 dark:border-slate-800/80"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        {col.name}
                      </span>
                      <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                        {colIssues.length}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenCreate(col.key)}
                      className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded transition"
                      title={`Add issue to ${col.name}`}
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
                        onDragOver={(e) => handleColumnDragOver(e, col.key)}
                        className="h-28 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-xs text-gray-400 gap-1"
                      >
                        <span>Drop cards here</span>
                        <span className="text-[10px] text-gray-400">or click + to add</span>
                      </div>
                    ) : (
                      colIssues.map((iss) => {
                        const prioConf = PRIORITY_CONFIG[iss.priority] || PRIORITY_CONFIG.medium;
                        const typeItem = issueTypes.find((t) => t.key === iss.type);
                        const typeIcon = typeItem?.icon || TYPE_CONFIG[iss.type]?.icon || "✓";
                        const typeLabel = typeItem?.name || TYPE_CONFIG[iss.type]?.label || "Task";
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
                                <span className="text-xs" title={`Type: ${typeLabel}`}>
                                  {typeIcon}
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
                                  {projectStatuses.map((c) => (
                                    <option key={c.key} value={c.key}>
                                      → {c.name}
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
                        const typeItem = issueTypes.find((t) => t.key === iss.type);
                        const typeIcon = typeItem?.icon || TYPE_CONFIG[iss.type]?.icon || "✓";
                        const typeLabel = typeItem?.name || TYPE_CONFIG[iss.type]?.label || "Task";
                        const currStatus = projectStatuses.find((s) => s.key === iss.status);
                        const statusStyle = getStatusStyle(currStatus?.color);

                        return (
                          <tr
                            key={iss.id}
                            onClick={() => setSelectedIssueId(iss.id)}
                            className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition"
                          >
                            <td className="py-3 px-4" title={typeLabel}>
                              <span className="text-sm">{typeIcon}</span>
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
                                className={`text-[11px] font-bold px-2 py-1 rounded-lg border border-transparent appearance-none cursor-pointer focus:outline-none ${statusStyle.bg} ${statusStyle.text}`}
                              >
                                {projectStatuses.map((c) => (
                                  <option key={c.key} value={c.key}>
                                    {c.name}
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
        projectStatuses={projectStatuses}
        issueTypes={issueTypes}
        currentIssueData={issues.find((i) => i.id === selectedIssueId) || null}
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
          projectStatuses={projectStatuses}
          issueTypes={issueTypes}
        />
      )}

      {/* Project Variables & Attributes Modal */}
      {showAttributesModal && project && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>🏷️ Project Variables &amp; Attributes</span>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                    {project.key}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Configure dynamic environment variables, REPO links, documentation URLs, and build endpoints.
                </p>
              </div>
              <button
                onClick={() => setShowAttributesModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              {/* Existing Attributes */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Configured Variables ({project.attributes?.length || 0})
                </h4>

                {!project.attributes || project.attributes.length === 0 ? (
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/40 border border-dashed border-gray-200 dark:border-slate-700 text-center">
                    <p className="text-xs text-gray-400 italic">No variables configured yet. Add your REPO or documentation URL below.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-slate-800 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
                    {project.attributes.map((attr: any) => {
                      const isUrl = /^https?:\/\//i.test(attr.value);
                      return (
                        <div key={attr.id} className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                              {attr.key}
                            </span>
                            <span className="text-xs text-gray-800 dark:text-gray-200 truncate font-mono">
                              {attr.value}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isUrl && (
                              <a
                                href={attr.value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg transition"
                                title="Open URL in new tab"
                              >
                                Open ↗
                              </a>
                            )}
                            <button
                              onClick={async () => {
                                await navigator.clipboard.writeText(attr.value);
                                alert(`Copied ${attr.key} to clipboard!`);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-slate-800 rounded-lg transition"
                              title="Copy value"
                            >
                              Copy
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Delete variable ${attr.key}?`)) return;
                                await fetch(`/api/projects/${project.key}/attributes?id=${attr.id}`, {
                                  method: "DELETE",
                                });
                                loadData();
                              }}
                              className="p-1 text-gray-400 hover:text-rose-500 rounded-lg transition"
                              title="Delete attribute"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add / Upsert Form */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Add / Update Variable
                  </span>
                  {/* Presets */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">Presets:</span>
                    {["REPO", "DOCS", "WEBSITE", "CI_CD"].map((pKey) => (
                      <button
                        key={pKey}
                        type="button"
                        onClick={() => setNewAttrKey(pKey)}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:text-indigo-600"
                      >
                        +{pKey}
                      </button>
                    ))}
                  </div>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newAttrKey.trim() || !newAttrVal.trim()) return;
                    setSavingAttribute(true);
                    try {
                      const res = await fetch(`/api/projects/${project.key}/attributes`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key: newAttrKey.trim(), value: newAttrVal.trim() }),
                      });
                      if (res.ok) {
                        setNewAttrKey("");
                        setNewAttrVal("");
                        await loadData();
                      }
                    } catch (err) {
                      console.error("Failed to save attribute:", err);
                    } finally {
                      setSavingAttribute(false);
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="KEY (e.g. REPO)"
                    value={newAttrKey}
                    onChange={(e) => setNewAttrKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                    className="w-36 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Value / URL (e.g. http://192.168.100.252:3000/...)"
                    value={newAttrVal}
                    onChange={(e) => setNewAttrVal(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={savingAttribute || !newAttrKey.trim() || !newAttrVal.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex-shrink-0"
                  >
                    {savingAttribute ? "Saving..." : "Save"}
                  </button>
                </form>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/40 flex items-center justify-end">
              <button
                onClick={() => setShowAttributesModal(false)}
                className="px-4 py-1.5 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
