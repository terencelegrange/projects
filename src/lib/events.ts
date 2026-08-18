import crypto from "crypto";
import { prisma } from "./prisma";

export type EventType =
  | "issue.created"
  | "issue.updated"
  | "issue.status_changed"
  | "issue.deleted"
  | "comment.created"
  | "project.created"
  | "project.updated"
  | "project.deleted";

export type EventAction = "create" | "update" | "delete" | "transition";

export interface UserSnapshot {
  id: number;
  name: string | null;
  email: string;
}

export interface ProjectSnapshot {
  id: number;
  key: string;
  name: string;
}

export interface IssueSnapshot {
  id: number;
  key: string;
  issue_number: number;
  title: string;
  status: string;
  previous_status?: string | null;
  priority: string;
  type: string;
  estimate?: number | null;
  due_date?: string | null;
  assignee?: UserSnapshot | null;
  reporter?: UserSnapshot | null;
}

export interface CommentSnapshot {
  id: number;
  content: string;
  created_at: string;
  user: UserSnapshot;
}

export interface EmitEventParams {
  eventType: EventType;
  action: EventAction;
  project: ProjectSnapshot;
  actor?: UserSnapshot | null;
  issue?: IssueSnapshot | null;
  comment?: CommentSnapshot | null;
  changes?: Record<string, { from: any; to: any }>;
  metadata?: Record<string, any>;
}

export interface WebhookPayload {
  id: string;
  event: EventType;
  action: EventAction;
  timestamp: string;
  actor: UserSnapshot | null;
  project: ProjectSnapshot;
  issue?: IssueSnapshot | null;
  comment?: CommentSnapshot | null;
  changes?: Record<string, { from: any; to: any }>;
  metadata?: Record<string, any>;
  api_urls: {
    issue?: string;
    issue_comments?: string;
    project: string;
    project_issues: string;
    project_statuses: string;
    project_attributes: string;
  };
}

/**
 * Emits a system event, persists it in the event log, and asynchronously dispatches to matching webhooks.
 */
export async function emitEvent(params: EmitEventParams): Promise<WebhookPayload> {
  const eventId = `evt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const timestamp = new Date().toISOString();

  const issueKey = params.issue?.key;
  const projectKey = params.project.key;

  const payload: WebhookPayload = {
    id: eventId,
    event: params.eventType,
    action: params.action,
    timestamp,
    actor: params.actor || null,
    project: params.project,
    issue: params.issue || null,
    comment: params.comment || null,
    changes: params.changes || undefined,
    metadata: params.metadata || undefined,
    api_urls: {
      issue: issueKey ? `/api/issues/${issueKey}` : undefined,
      issue_comments: issueKey ? `/api/issues/${issueKey}/comments` : undefined,
      project: `/api/projects/${projectKey}`,
      project_issues: `/api/projects/${projectKey}/issues`,
      project_statuses: `/api/projects/${projectKey}/statuses`,
      project_attributes: `/api/projects/${projectKey}/attributes`,
    },
  };

  const payloadJson = JSON.stringify(payload);

  // 1. Persist System Event in Database
  try {
    await prisma.systemEvent.create({
      data: {
        event_id: eventId,
        event_type: params.eventType,
        action: params.action,
        resource_type: params.issue ? "issue" : params.comment ? "comment" : "project",
        resource_key: issueKey || projectKey,
        project_key: projectKey,
        project_id: params.project.id,
        actor_id: params.actor?.id || null,
        payload: payloadJson,
      },
    });
  } catch (err) {
    console.error("[events.ts] Failed to persist system event:", err);
  }

  // 2. Dispatch to matching active webhooks in background
  dispatchToWebhooks(payload).catch((err) => {
    console.error("[events.ts] Webhook dispatch worker error:", err);
  });

  return payload;
}

/**
 * Dispatches a webhook payload to all matching registered webhooks.
 */
async function dispatchToWebhooks(payload: WebhookPayload) {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { active: true },
    });

    if (webhooks.length === 0) return;

    const payloadString = JSON.stringify(payload);

    await Promise.allSettled(
      webhooks.map(async (webhook) => {
        // Check project filter
        if (webhook.project_id && webhook.project_id !== payload.project.id) {
          return;
        }

        // Check event filter
        let subscribedEvents: string[] = [];
        try {
          subscribedEvents = JSON.parse(webhook.events);
        } catch {
          subscribedEvents = webhook.events.split(",").map((s) => s.trim());
        }

        const isSubscribed =
          subscribedEvents.includes("*") ||
          subscribedEvents.includes(payload.event) ||
          (payload.event.startsWith("issue.") && subscribedEvents.includes("issue.*")) ||
          (payload.event.startsWith("comment.") && subscribedEvents.includes("comment.*")) ||
          (payload.event.startsWith("project.") && subscribedEvents.includes("project.*"));

        if (!isSubscribed) return;

        // Prepare headers & HMAC signature
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "Projects-Webhook/1.0",
          "X-Event-Type": payload.event,
          "X-Event-ID": payload.id,
          "X-Event-Action": payload.action,
          "X-Project-Key": payload.project.key,
        };

        if (webhook.secret) {
          const hmac = crypto.createHmac("sha256", webhook.secret);
          hmac.update(payloadString);
          headers["X-Webhook-Signature-256"] = `sha256=${hmac.digest("hex")}`;
        }

        const startTime = Date.now();
        let status: number | null = null;
        let responseBody: string | null = null;
        let errorMsg: string | null = null;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 7000);

          const res = await fetch(webhook.url, {
            method: "POST",
            headers,
            body: payloadString,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          status = res.status;
          const text = await res.text();
          responseBody = text.slice(0, 1000); // cap to 1000 chars
        } catch (fetchErr: any) {
          errorMsg = fetchErr.message || String(fetchErr);
        }

        const duration = Date.now() - startTime;

        // Record delivery log
        await prisma.webhookDelivery.create({
          data: {
            webhook_id: webhook.id,
            event_id: payload.id,
            event_type: payload.event,
            payload: payloadString,
            response_status: status,
            response_body: responseBody,
            duration_ms: duration,
            error: errorMsg,
          },
        }).catch((e) => console.error("[events.ts] Failed to log webhook delivery:", e));
      })
    );
  } catch (err) {
    console.error("[events.ts] Error querying webhooks:", err);
  }
}
