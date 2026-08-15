import { prisma } from "./prisma";

// How long a notification stays "open" for appending -- a burst of moves
// into the same status within this window collapses into one digest row
// instead of spamming the bell with one notification per card.
const DIGEST_WINDOW_MS = 5 * 60 * 1000;

interface NotifyStatusChangeParams {
  projectId: number;
  statusKey: string;
  issueKey: string;
}

/**
 * Called after an issue's status changes. If the target status is flagged
 * notify_on_enter, appends to (or creates) a per-user digest notification
 * rather than writing one row per move.
 */
export async function notifyStatusChange({
  projectId,
  statusKey,
  issueKey,
}: NotifyStatusChangeParams): Promise<void> {
  try {
    const status = await prisma.projectStatus.findUnique({
      where: { project_status_key: { project_id: projectId, key: statusKey } },
      select: { notify_on_enter: true, name: true },
    });
    if (!status?.notify_on_enter) return;
    const statusName = status.name;

    // Recipients: admin users. This is a small/single-user workspace by
    // design (see CLAUDE.md) -- notifying admins covers the owner without
    // needing per-issue assignee/watcher logic.
    const admins = await prisma.user.findMany({
      where: { role: "admin", status: "approved" },
      select: { id: true },
    });
    if (admins.length === 0) return;

    const cutoff = new Date(Date.now() - DIGEST_WINDOW_MS);

    for (const admin of admins) {
      const openDigest = await prisma.notification.findFirst({
        where: {
          user_id: admin.id,
          project_id: projectId,
          status_key: statusKey,
          read: false,
          updated_at: { gte: cutoff },
        },
        orderBy: { updated_at: "desc" },
      });

      if (openDigest) {
        const issueKeys: string[] = JSON.parse(openDigest.issue_ids);
        if (!issueKeys.includes(issueKey)) issueKeys.push(issueKey);
        await prisma.notification.update({
          where: { id: openDigest.id },
          data: {
            issue_ids: JSON.stringify(issueKeys),
            count: issueKeys.length,
          },
        });
      } else {
        await prisma.notification.create({
          data: {
            user_id: admin.id,
            project_id: projectId,
            status_key: statusKey,
            status_name: statusName,
            issue_ids: JSON.stringify([issueKey]),
            count: 1,
          },
        });
      }
    }
  } catch (e) {
    // Never let a notification failure break the issue update itself.
    console.error("[notifyStatusChange] failed:", e);
  }
}
