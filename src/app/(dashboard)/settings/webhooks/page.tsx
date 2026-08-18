"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ProjectOption {
  id: number;
  key: string;
  name: string;
}

interface WebhookItem {
  id: number;
  name: string;
  url: string;
  hasSecret: boolean;
  events: string[];
  project: ProjectOption | null;
  active: boolean;
  totalDeliveries: number;
  lastDelivery: {
    status: number | null;
    durationMs: number | null;
    createdAt: string;
    error: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryLogItem {
  id: number;
  eventId: string;
  eventType: string;
  responseStatus: number | null;
  responseBody: string | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
  payload: any;
}

interface EventItem {
  id: string;
  eventType: string;
  action: string;
  resourceType: string;
  resourceKey: string;
  projectKey: string;
  createdAt: string;
  payload: any;
}

const AVAILABLE_EVENTS = [
  { key: "issue.status_changed", label: "Issue Status Changed", desc: "Triggered when an issue transitions stages (e.g. backlog -> todo)" },
  { key: "issue.created", label: "Issue Created", desc: "Triggered when a new work item is opened" },
  { key: "issue.updated", label: "Issue Updated", desc: "Triggered on title, priority, assignee, or field edits" },
  { key: "issue.deleted", label: "Issue Deleted", desc: "Triggered when an issue is removed" },
  { key: "comment.created", label: "Comment Added", desc: "Triggered when a discussion response is posted" },
];

export default function WebhooksPage() {
  const [activeTab, setActiveTab] = useState<"webhooks" | "events">("webhooks");

  // Webhooks State
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(true);

  // Webhook Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formProjectId, setFormProjectId] = useState<string>("");
  const [formEvents, setFormEvents] = useState<string[]>(["*"]);
  const [formActive, setFormActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Deliveries Modal State
  const [selectedWebhookForDeliveries, setSelectedWebhookForDeliveries] = useState<WebhookItem | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryLogItem[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  // Test Ping State
  const [testingWebhookId, setTestingWebhookId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; status?: number; error?: string } | null>(null);

  // Events Feed State
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventProjectFilter, setEventProjectFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  async function loadWebhooksData() {
    setLoadingWebhooks(true);
    try {
      const [whRes, projRes] = await Promise.all([
        fetch("/api/webhooks"),
        fetch("/api/projects"),
      ]);

      if (whRes.ok) {
        const whData = await whRes.json();
        setWebhooks(whData);
      }

      if (projRes.ok) {
        const projData = await projRes.json();
        setProjects(projData.map((p: any) => ({ id: p.id, key: p.key, name: p.name })));
      }
    } catch (err) {
      console.error("Failed to load webhooks:", err);
    } finally {
      setLoadingWebhooks(false);
    }
  }

  async function loadEventsData() {
    setLoadingEvents(true);
    try {
      const params = new URLSearchParams();
      if (eventProjectFilter !== "all") params.set("projectKey", eventProjectFilter);
      if (eventTypeFilter !== "all") params.set("eventType", eventTypeFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/events?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoadingEvents(false);
    }
  }

  useEffect(() => {
    loadWebhooksData();
  }, []);

  useEffect(() => {
    if (activeTab === "events") {
      loadEventsData();
    }
  }, [activeTab, eventProjectFilter, eventTypeFilter]);

  function handleOpenCreate() {
    setEditingWebhook(null);
    setFormName("");
    setFormUrl("");
    setFormSecret("");
    setFormProjectId("");
    setFormEvents(["*"]);
    setFormActive(true);
    setFormError(null);
    setShowModal(true);
  }

  function handleOpenEdit(wh: WebhookItem) {
    setEditingWebhook(wh);
    setFormName(wh.name);
    setFormUrl(wh.url);
    setFormSecret("");
    setFormProjectId(wh.project ? String(wh.project.id) : "");
    setFormEvents(wh.events);
    setFormActive(wh.active);
    setFormError(null);
    setShowModal(true);
  }

  function generateRandomSecret() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    let str = "whsec_";
    for (let i = 0; i < 32; i++) {
      str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormSecret(str);
  }

  function toggleEventSelection(eventKey: string) {
    if (eventKey === "*") {
      setFormEvents(["*"]);
      return;
    }

    setFormEvents((prev) => {
      let filtered = prev.filter((e) => e !== "*");
      if (filtered.includes(eventKey)) {
        filtered = filtered.filter((e) => e !== eventKey);
      } else {
        filtered = [...filtered, eventKey];
      }
      return filtered.length === 0 ? ["*"] : filtered;
    });
  }

  async function handleSaveWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formUrl.trim()) {
      setFormError("Webhook name and valid URL are required.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload: any = {
        name: formName.trim(),
        url: formUrl.trim(),
        events: formEvents,
        project_id: formProjectId ? Number(formProjectId) : null,
        active: formActive,
      };

      if (formSecret.trim()) {
        payload.secret = formSecret.trim();
      }

      if (editingWebhook) {
        const res = await fetch(`/api/webhooks/${editingWebhook.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update webhook");
        }
      } else {
        const res = await fetch("/api/webhooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create webhook");
        }
      }

      await loadWebhooksData();
      setShowModal(false);
    } catch (err: any) {
      setFormError(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(wh: WebhookItem) {
    try {
      const res = await fetch(`/api/webhooks/${wh.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !wh.active }),
      });
      if (res.ok) {
        setWebhooks((prev) =>
          prev.map((item) => (item.id === wh.id ? { ...item, active: !wh.active } : item))
        );
      }
    } catch (err) {
      console.error("Failed to toggle webhook:", err);
    }
  }

  async function handleDeleteWebhook(wh: WebhookItem) {
    if (!confirm(`Are you sure you want to delete webhook '${wh.name}'?`)) return;

    try {
      const res = await fetch(`/api/webhooks/${wh.id}`, { method: "DELETE" });
      if (res.ok) {
        setWebhooks((prev) => prev.filter((item) => item.id !== wh.id));
      }
    } catch (err) {
      console.error("Failed to delete webhook:", err);
    }
  }

  async function handleTestPing(wh: WebhookItem) {
    setTestingWebhookId(wh.id);
    setTestResult(null);

    try {
      const res = await fetch(`/api/webhooks/${wh.id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult({
        id: wh.id,
        success: data.success,
        status: data.delivery?.status,
        error: data.delivery?.error,
      });
      await loadWebhooksData();
    } catch (err: any) {
      setTestResult({
        id: wh.id,
        success: false,
        error: err.message || "Failed to send test ping",
      });
    } finally {
      setTestingWebhookId(null);
    }
  }

  async function handleOpenDeliveries(wh: WebhookItem) {
    setSelectedWebhookForDeliveries(wh);
    setLoadingDeliveries(true);
    try {
      const res = await fetch(`/api/webhooks/${wh.id}/deliveries`);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data);
      }
    } catch (err) {
      console.error("Failed to fetch deliveries:", err);
    } finally {
      setLoadingDeliveries(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">
            <Link href="/settings" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Settings
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">Webhooks &amp; Events</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <span>⚡ Webhooks &amp; Events</span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Real-time HTTP webhooks and event streaming for 3rd-party bots, CI/CD pipelines, and external integrations.
          </p>
        </div>

        {/* Tab Switcher & Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("webhooks")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "webhooks"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Webhooks ({webhooks.length})
            </button>
            <button
              onClick={() => setActiveTab("events")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "events"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              📡 Live Events Stream
            </button>
          </div>

          {activeTab === "webhooks" && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <span>+ Add Webhook</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: WEBHOOKS LIST */}
      {activeTab === "webhooks" && (
        <div className="space-y-4">
          {loadingWebhooks ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs text-gray-400 animate-pulse">Loading webhook subscriptions...</p>
            </div>
          ) : webhooks.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mx-auto text-xl">
                ⚡
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">No webhooks registered</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Configure webhook endpoints to notify your servers or 3rd-party apps whenever issues are created, updated, or transition status stages.
              </p>
              <button
                onClick={handleOpenCreate}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition"
              >
                + Register First Webhook
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {webhooks.map((wh) => {
                const isTesting = testingWebhookId === wh.id;
                const result = testResult?.id === wh.id ? testResult : null;

                return (
                  <div
                    key={wh.id}
                    className={`bg-white dark:bg-slate-900 border ${
                      wh.active
                        ? "border-gray-200 dark:border-slate-800"
                        : "border-gray-200/50 dark:border-slate-800/50 opacity-70"
                    } rounded-2xl p-5 shadow-xs hover:border-gray-300 dark:hover:border-slate-700 transition space-y-4`}
                  >
                    {/* Top Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-3 h-3 rounded-full ${
                            wh.active ? "bg-emerald-500 ring-4 ring-emerald-500/20" : "bg-gray-400"
                          }`}
                          title={wh.active ? "Active" : "Disabled"}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{wh.name}</h3>
                            {wh.hasSecret && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                🔒 HMAC-SHA256
                              </span>
                            )}
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                              {wh.project ? `Project: ${wh.project.key}` : "All Projects"}
                            </span>
                          </div>
                          <p className="font-mono text-xs text-gray-500 dark:text-gray-400 mt-1 break-all select-all">
                            {wh.url}
                          </p>
                        </div>
                      </div>

                      {/* Action Controls */}
                      <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                        {/* Test Button */}
                        <button
                          onClick={() => handleTestPing(wh)}
                          disabled={isTesting}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                          title="Send test ping payload"
                        >
                          <span>{isTesting ? "⏳" : "⚡"}</span>
                          <span>{isTesting ? "Sending..." : "Test Ping"}</span>
                        </button>

                        {/* Deliveries Button */}
                        <button
                          onClick={() => handleOpenDeliveries(wh)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                          title="View delivery logs"
                        >
                          <span>📋</span>
                          <span>Logs ({wh.totalDeliveries})</span>
                        </button>

                        {/* Toggle Active */}
                        <button
                          onClick={() => handleToggleActive(wh)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                            wh.active
                              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                              : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                          }`}
                        >
                          {wh.active ? "Pause" : "Enable"}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => handleOpenEdit(wh)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
                          title="Edit webhook"
                        >
                          ✏️
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteWebhook(wh)}
                          className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
                          title="Delete webhook"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Test result alert */}
                    {result && (
                      <div
                        className={`p-3 rounded-xl text-xs font-mono flex items-center justify-between gap-2 ${
                          result.success
                            ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                            : "bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{result.success ? "✓ Ping Delivered Successfully" : "✕ Delivery Failed"}</span>
                          {result.status && <span className="font-bold">HTTP {result.status}</span>}
                          {result.error && <span className="text-[11px]">({result.error})</span>}
                        </div>
                        <button onClick={() => setTestResult(null)} className="text-gray-400 hover:text-gray-600">
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Subscribed Events Tags & Last Delivery summary */}
                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Subscribed:</span>
                        {wh.events.map((ev) => (
                          <span
                            key={ev}
                            className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs">
                        <span>Last delivery:</span>
                        {wh.lastDelivery ? (
                          <span
                            className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                              wh.lastDelivery.status && wh.lastDelivery.status >= 200 && wh.lastDelivery.status < 300
                                ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                                : "bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {wh.lastDelivery.status ? `HTTP ${wh.lastDelivery.status}` : "Error"} (
                            {wh.lastDelivery.durationMs}ms)
                          </span>
                        ) : (
                          <span className="italic text-gray-400">Never triggered</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE EVENTS STREAM */}
      {activeTab === "events" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Project Filter */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Project</label>
                <select
                  value={eventProjectFilter}
                  onChange={(e) => setEventProjectFilter(e.target.value)}
                  className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white"
                >
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.key} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Type Filter */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Event Type</label>
                <select
                  value={eventTypeFilter}
                  onChange={(e) => setEventTypeFilter(e.target.value)}
                  className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white"
                >
                  <option value="all">All Event Types</option>
                  {AVAILABLE_EVENTS.map((ev) => (
                    <option key={ev.key} value={ev.key}>
                      {ev.label} ({ev.key})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadEventsData}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition"
              >
                🔄 Refresh Stream
              </button>
            </div>
          </div>

          {/* Events Stream Feed */}
          {loadingEvents ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs text-gray-400 animate-pulse">Loading event stream...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800">
              <p className="text-xs text-gray-400 italic">No events match the current filter criteria.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => {
                const isExpanded = expandedEventId === ev.id;
                const statusChange = ev.payload?.changes?.status;

                return (
                  <div
                    key={ev.id}
                    className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                          {ev.id}
                        </span>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                          {ev.eventType}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          {ev.action}
                        </span>
                        <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">
                          {ev.resourceKey}
                        </span>
                      </div>

                      <span className="text-xs text-gray-400">
                        {new Date(ev.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>

                    {/* Event Summary */}
                    <div className="flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        {ev.payload?.actor && (
                          <span className="text-gray-400">
                            By <strong className="text-gray-700 dark:text-gray-200">{ev.payload.actor.name || ev.payload.actor.email}</strong>
                          </span>
                        )}
                        {ev.payload?.issue?.title && (
                          <span className="text-gray-600 dark:text-gray-400">
                            — &ldquo;{ev.payload.issue.title}&rdquo;
                          </span>
                        )}
                        {statusChange && (
                          <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                            {statusChange.from} ➔ {statusChange.to}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {isExpanded ? "Hide JSON ▲" : "View JSON Payload ▼"}
                      </button>
                    </div>

                    {/* Hypermedia API URLs */}
                    {ev.payload?.api_urls && (
                      <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="text-gray-400 font-bold uppercase tracking-wider">API Endpoints:</span>
                        {Object.entries(ev.payload.api_urls).map(([apiKey, apiPath]) => (
                          <span
                            key={apiKey}
                            className="font-mono px-2 py-0.5 rounded bg-gray-50 dark:bg-slate-800/80 text-gray-600 dark:text-gray-300 border border-gray-200/80 dark:border-slate-700"
                          >
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{apiKey}:</span> {String(apiPath)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Expanded Payload Viewer */}
                    {isExpanded && (
                      <div className="mt-2 rounded-xl bg-slate-950 border border-slate-800 p-4 relative">
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(JSON.stringify(ev.payload, null, 2));
                            alert("Copied event JSON to clipboard!");
                          }}
                          className="absolute right-3 top-3 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-semibold"
                        >
                          📋 Copy JSON
                        </button>
                        <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                          {JSON.stringify(ev.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT WEBHOOK */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {editingWebhook ? "Edit Webhook Subscription" : "Register New Webhook"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveWebhook} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-semibold">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Webhook Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Slack Issue Notifications / CI Sync"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Payload URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.yourdomain.com/webhook/endpoint"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Secret Token */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Secret Token (HMAC-SHA256)
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomSecret}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Generate Secret
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Optional secret for X-Webhook-Signature-256 header"
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Project Scope Filter */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Project Scope
                </label>
                <select
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Projects (System-wide)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.key} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Subscriptions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Trigger Events
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormEvents(formEvents.includes("*") ? ["issue.status_changed"] : ["*"])}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {formEvents.includes("*") ? "Custom Selection" : "Send All Events (*)"}
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 p-3 bg-gray-50/50 dark:bg-slate-800/40">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formEvents.includes("*")}
                      onChange={() => toggleEventSelection("*")}
                      className="mt-0.5 rounded text-indigo-600"
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">All Events (*)</p>
                      <p className="text-[11px] text-gray-400">Send notifications for all event types</p>
                    </div>
                  </label>

                  {AVAILABLE_EVENTS.map((ev) => {
                    const isChecked = formEvents.includes("*") || formEvents.includes(ev.key);
                    return (
                      <label key={ev.key} className="flex items-start gap-2 cursor-pointer pt-1 border-t border-gray-100 dark:border-slate-700/60">
                        <input
                          type="checkbox"
                          disabled={formEvents.includes("*")}
                          checked={isChecked}
                          onChange={() => toggleEventSelection(ev.key)}
                          className="mt-0.5 rounded text-indigo-600"
                        />
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white font-mono">{ev.key}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">{ev.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition"
                >
                  {submitting ? "Saving..." : editingWebhook ? "Save Changes" : "Create Webhook"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELIVERIES LOGS */}
      {selectedWebhookForDeliveries && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>Delivery Logs:</span>
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedWebhookForDeliveries.name}
                  </span>
                </h3>
                <p className="text-xs font-mono text-gray-400 truncate max-w-md">
                  {selectedWebhookForDeliveries.url}
                </p>
              </div>
              <button
                onClick={() => setSelectedWebhookForDeliveries(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {loadingDeliveries ? (
                <div className="py-12 text-center">
                  <p className="text-xs text-gray-400 animate-pulse">Loading delivery attempts...</p>
                </div>
              ) : deliveries.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-xs text-gray-400 italic">No delivery attempts recorded for this webhook yet.</p>
                </div>
              ) : (
                deliveries.map((del) => {
                  const isSuccess = del.responseStatus && del.responseStatus >= 200 && del.responseStatus < 300;

                  return (
                    <div
                      key={del.id}
                      className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                              isSuccess
                                ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                : "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                            }`}
                          >
                            {del.responseStatus ? `HTTP ${del.responseStatus}` : "Failed"}
                          </span>
                          <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                            {del.eventType}
                          </span>
                          <span className="text-gray-400 text-[11px]">({del.durationMs}ms)</span>
                        </div>
                        <span className="text-gray-400 text-[11px]">
                          {new Date(del.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {del.error && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 font-mono bg-rose-50 dark:bg-rose-950/50 p-2 rounded-lg">
                          Error: {del.error}
                        </p>
                      )}

                      {del.responseBody && (
                        <div className="text-[11px] font-mono text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-gray-200 dark:border-slate-700 truncate">
                          Response: {del.responseBody}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-gray-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedWebhookForDeliveries(null)}
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
