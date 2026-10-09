/**
 * Maps color hex / names to clean Tailwind badge styling classes.
 */
export function getIssueTypeStyle(color?: string | null): { bg: string; text: string; border: string; dot: string } {
  if (!color) {
    return {
      bg: "bg-blue-50 dark:bg-blue-950/40",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-200 dark:border-blue-800",
      dot: "bg-blue-500",
    };
  }

  const c = color.toLowerCase();
  if (c.includes("ef4444") || c.includes("red") || c.includes("rose")) {
    return {
      bg: "bg-rose-50 dark:bg-rose-950/40",
      text: "text-rose-700 dark:text-rose-300",
      border: "border-rose-200 dark:border-rose-800",
      dot: "bg-rose-500",
    };
  }
  if (c.includes("10b981") || c.includes("green") || c.includes("emerald")) {
    return {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-200 dark:border-emerald-800",
      dot: "bg-emerald-500",
    };
  }
  if (c.includes("a855f7") || c.includes("purple") || c.includes("violet")) {
    return {
      bg: "bg-purple-50 dark:bg-purple-950/40",
      text: "text-purple-700 dark:text-purple-300",
      border: "border-purple-200 dark:border-purple-800",
      dot: "bg-purple-500",
    };
  }
  if (c.includes("f59e0b") || c.includes("amber") || c.includes("yellow") || c.includes("orange")) {
    return {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-800",
      dot: "bg-amber-500",
    };
  }
  if (c.includes("6366f1") || c.includes("indigo")) {
    return {
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      text: "text-indigo-700 dark:text-indigo-300",
      border: "border-indigo-200 dark:border-indigo-800",
      dot: "bg-indigo-500",
    };
  }
  if (c.includes("94a3b8") || c.includes("gray") || c.includes("slate")) {
    return {
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-700 dark:text-slate-300",
      border: "border-slate-200 dark:border-slate-700",
      dot: "bg-slate-400",
    };
  }

  return {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
  };
}
