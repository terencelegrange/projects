export interface StatusDefinition {
  key: string;
  defaultLabel: string;
  label: string;
  dot: string;
  bg: string;
  text: string;
  description?: string;
}

export const DEFAULT_STATUSES: StatusDefinition[] = [
  {
    key: "backlog",
    defaultLabel: "Backlog",
    label: "Backlog",
    dot: "bg-gray-400",
    bg: "bg-gray-100 dark:bg-slate-800",
    text: "text-gray-700 dark:text-gray-300",
    description: "Ideas, feature requests, and future roadmap items",
  },
  {
    key: "todo",
    defaultLabel: "To Do",
    label: "To Do",
    dot: "bg-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    description: "Prioritized work ready for engineering pickup",
  },
  {
    key: "in_progress",
    defaultLabel: "In Progress",
    label: "In Progress",
    dot: "bg-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    description: "Active development currently underway",
  },
  {
    key: "in_review",
    defaultLabel: "In Review",
    label: "In Review",
    dot: "bg-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    description: "Code review, QA verification, or PR approval",
  },
  {
    key: "done",
    defaultLabel: "Done",
    label: "Done",
    dot: "bg-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    description: "Completed, verified, and shipped",
  },
  {
    key: "canceled",
    defaultLabel: "Canceled",
    label: "Canceled",
    dot: "bg-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    description: "Declined or discarded work items",
  },
];

export async function getEffectiveStatuses(): Promise<StatusDefinition[]> {
  try {
    const { prisma } = await import("./prisma");
    const customs = await prisma.customStatus.findMany();
    const customMap = new Map(customs.map((c) => [c.key, c.label]));

    return DEFAULT_STATUSES.map((s) => ({
      ...s,
      label: customMap.get(s.key)?.trim() || s.defaultLabel,
    }));
  } catch {
    return DEFAULT_STATUSES;
  }
}

export async function getStatusLabelMap(): Promise<Record<string, string>> {
  const statuses = await getEffectiveStatuses();
  const map: Record<string, string> = {};
  for (const s of statuses) {
    map[s.key] = s.label;
  }
  return map;
}
