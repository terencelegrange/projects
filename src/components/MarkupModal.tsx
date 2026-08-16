"use client";

import { useEffect, useState } from "react";
import MarkupRenderer from "./MarkupRenderer";

interface MarkupModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  issueKey?: string;
  content: string;
}

export default function MarkupModal({
  isOpen,
  onClose,
  title,
  issueKey,
  content,
}: MarkupModalProps) {
  const [viewMode, setViewMode] = useState<"rendered" | "raw" | "split">("rendered");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy content:", e);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/50 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {issueKey && (
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex-shrink-0">
                {issueKey}
              </span>
            )}
            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
              {title || "Issue Description"}
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-gray-200/80 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode("rendered")}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  viewMode === "rendered"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
                title="Rendered Markdown & HTML"
              >
                <span>👁️</span>
                <span>Rendered</span>
              </button>

              <button
                onClick={() => setViewMode("raw")}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  viewMode === "raw"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
                title="Raw Markup Source"
              >
                <span>💻</span>
                <span>Source</span>
              </button>

              <button
                onClick={() => setViewMode("split")}
                className={`hidden md:flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  viewMode === "split"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
                title="Side-by-side Split View"
              >
                <span>🔀</span>
                <span>Split</span>
              </button>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold transition"
              title="Copy raw markdown/HTML to clipboard"
            >
              <span>{copied ? "✓ Copied" : "📋 Copy"}</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
              title="Close modal (Esc)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
          {viewMode === "rendered" ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl">
              <MarkupRenderer content={content} />
            </div>
          ) : viewMode === "raw" ? (
            <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xs p-4">
              <pre className="text-xs font-mono text-slate-100 whitespace-pre-wrap leading-relaxed select-text">
                {content || "// No description content"}
              </pre>
            </div>
          ) : (
            /* Split View */
            <div className="grid grid-cols-2 gap-6 h-full">
              {/* Left Column: Raw Source */}
              <div className="flex flex-col bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-y-auto">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-gray-400 mb-2 pb-1 border-b border-slate-800">
                  Raw Markup Source
                </span>
                <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed select-text flex-1">
                  {content || "// No description content"}
                </pre>
              </div>

              {/* Right Column: Rendered Preview */}
              <div className="flex flex-col bg-gray-50/50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-xl p-5 overflow-y-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 pb-1 border-b border-gray-200 dark:border-slate-700">
                  Rendered Preview
                </span>
                <div className="flex-1">
                  <MarkupRenderer content={content} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/40 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span>Supports Markdown (headings, tables, lists, code) and HTML tags</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
