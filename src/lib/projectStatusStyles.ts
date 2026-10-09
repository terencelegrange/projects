/**
 * Returns dynamic styling classes for a status dot & pill based on its color
 */
export function getStatusStyle(color?: string | null) {
  const c = (color || "#94a3b8").toLowerCase();

  if (c.includes("emerald") || c.includes("green") || c === "#10b981" || c === "#22c55e") {
    return {
      dot: "bg-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-200 dark:border-emerald-800",
    };
  }
  if (c.includes("blue") || c.includes("sky") || c === "#3b82f6" || c === "#0ea5e9") {
    return {
      dot: "bg-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-200 dark:border-blue-800",
    };
  }
  if (c.includes("amber") || c.includes("yellow") || c.includes("orange") || c === "#f59e0b" || c === "#f97316") {
    return {
      dot: "bg-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-800",
    };
  }
  if (c.includes("purple") || c.includes("violet") || c.includes("indigo") || c === "#a855f7" || c === "#8b5cf6" || c === "#6366f1") {
    return {
      dot: "bg-purple-500",
      bg: "bg-purple-50 dark:bg-purple-950/40",
      text: "text-purple-700 dark:text-purple-300",
      border: "border-purple-200 dark:border-purple-800",
    };
  }
  if (c.includes("red") || c.includes("rose") || c === "#ef4444" || c === "#f43f5e") {
    return {
      dot: "bg-rose-500",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      text: "text-rose-700 dark:text-rose-300",
      border: "border-rose-200 dark:border-rose-800",
    };
  }

  return {
    dot: "bg-slate-400",
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
  };
}
