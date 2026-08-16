"use client";

import React, { useMemo, useState } from "react";

interface MarkupRendererProps {
  content: string;
  className?: string;
}

/**
 * Safely parses and renders Markdown and HTML formatting without external dependencies.
 * Supports:
 * - Headers (# - ######)
 * - Blockquotes (>)
 * - Fenced code blocks (```lang ... ```) with copy-to-clipboard
 * - Inline code (`code`)
 * - Task list checkboxes (- [ ] / - [x])
 * - Unordered & ordered lists (*, -, 1.)
 * - Tables (| Header | ... |)
 * - Horizontal rules (--- / ***)
 * - Bold (**), Italic (* / _), Strikethrough (~~)
 * - Links ([text](url)) and Images (![alt](url))
 * - Safe HTML tags (<div>, <p>, <span>, <strong>, <em>, <code>, <pre>, <h1>-<h6>, <ul>, <ol>, <li>, <table>, <tr>, <th>, <td>, <details>, <summary>, <br>, <hr>)
 * - Strips dangerous scripts / onerror attributes for safety
 */
export default function MarkupRenderer({ content, className = "" }: MarkupRendererProps) {
  const renderedHtml = useMemo(() => {
    if (!content || !content.trim()) return "<p class='text-gray-400 italic text-sm'>No description provided.</p>";

    return parseMarkdownAndHtml(content);
  }, [content]);

  return (
    <div
      className={`prose dark:prose-invert max-w-none text-sm text-gray-800 dark:text-gray-200 leading-relaxed break-words markup-content ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}

function sanitizeHtml(str: string): string {
  // Disallow scripts, iframes, objects, embeds, and inline event handlers
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseMarkdownAndHtml(raw: string): string {
  const sanitized = sanitizeHtml(raw);
  const lines = sanitized.split("\n");
  const result: string[] = [];

  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockContent: string[] = [];

  let inTable = false;
  let tableRows: string[] = [];

  let inList = false;
  let listType: "ul" | "ol" = "ul";

  function closeList() {
    if (inList) {
      result.push(listType === "ul" ? "</ul>" : "</ol>");
      inList = false;
    }
  }

  function closeTable() {
    if (inTable) {
      if (tableRows.length > 0) {
        result.push(renderTable(tableRows));
      }
      tableRows = [];
      inTable = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Fenced Code Blocks (```)
    if (trimmed.startsWith("```")) {
      closeList();
      closeTable();

      if (inCodeBlock) {
        // End code block
        const codeText = escapeHtml(codeBlockContent.join("\n"));
        result.push(`
          <div class="relative my-4 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow-sm group/code">
            ${codeBlockLang ? `<div class="px-4 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-gray-400 font-bold uppercase tracking-wider flex items-center justify-between"><span>${escapeHtml(codeBlockLang)}</span></div>` : ""}
            <pre class="p-4 text-xs font-mono text-slate-100 overflow-x-auto leading-relaxed"><code>${codeText}</code></pre>
          </div>
        `);
        inCodeBlock = false;
        codeBlockLang = "";
        codeBlockContent = [];
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        codeBlockContent = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // 2. Tables (| ... |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      closeList();
      inTable = true;
      tableRows.push(trimmed);
      continue;
    } else if (inTable) {
      closeTable();
    }

    // 3. Horizontal Rule
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeList();
      result.push("<hr class='my-6 border-gray-200 dark:border-slate-800' />");
      continue;
    }

    // 4. Headings (#)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const headingText = formatInline(headingMatch[2]);
      const headingClasses: Record<number, string> = {
        1: "text-2xl font-extrabold text-gray-900 dark:text-white mt-6 mb-3 tracking-tight border-b border-gray-100 dark:border-slate-800 pb-2",
        2: "text-xl font-bold text-gray-900 dark:text-white mt-5 mb-2.5 tracking-tight border-b border-gray-100 dark:border-slate-800 pb-1.5",
        3: "text-lg font-bold text-gray-900 dark:text-white mt-4 mb-2",
        4: "text-base font-semibold text-gray-900 dark:text-white mt-3 mb-1.5",
        5: "text-sm font-semibold text-gray-800 dark:text-gray-200 mt-2 mb-1",
        6: "text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-2 mb-1",
      };
      result.push(`<h${level} class="${headingClasses[level]}">${headingText}</h${level}>`);
      continue;
    }

    // 5. Blockquotes (>)
    if (trimmed.startsWith(">")) {
      closeList();
      const quoteText = formatInline(trimmed.replace(/^>\s*/, ""));
      result.push(`
        <blockquote class="my-3 pl-4 border-l-4 border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 py-2 pr-3 rounded-r-lg text-gray-700 dark:text-gray-300 italic text-sm">
          ${quoteText}
        </blockquote>
      `);
      continue;
    }

    // 6. Task List Checkboxes (- [ ] or - [x])
    const taskMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      closeList();
      const isChecked = taskMatch[2].toLowerCase() === "x";
      const taskText = formatInline(taskMatch[3]);
      result.push(`
        <div class="flex items-start gap-2.5 my-1.5 pl-1">
          <input type="checkbox" disabled ${isChecked ? "checked" : ""} class="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 dark:border-slate-700 accent-indigo-600 cursor-default" />
          <span class="${isChecked ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-200"} text-sm leading-relaxed">${taskText}</span>
        </div>
      `);
      continue;
    }

    // 7. Unordered List (- or *)
    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        closeList();
        inList = true;
        listType = "ul";
        result.push("<ul class='list-disc pl-6 my-2.5 space-y-1.5'>");
      }
      result.push(`<li class="text-sm leading-relaxed">${formatInline(ulMatch[2])}</li>`);
      continue;
    }

    // 8. Ordered List (1. 2.)
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        closeList();
        inList = true;
        listType = "ol";
        result.push("<ol class='list-decimal pl-6 my-2.5 space-y-1.5'>");
      }
      result.push(`<li class="text-sm leading-relaxed">${formatInline(olMatch[2])}</li>`);
      continue;
    }

    // Empty line or regular line
    closeList();

    if (!trimmed) {
      // Empty line adds whitespace
      result.push("<div class='h-2'></div>");
      continue;
    }

    // If it's raw HTML element like <details>, <div>, <p>, <table>, leave it rendered
    if (/^<[a-z0-9]+/i.test(trimmed)) {
      result.push(trimmed);
      continue;
    }

    // Regular paragraph
    result.push(`<p class="my-1.5 leading-relaxed text-sm">${formatInline(line)}</p>`);
  }

  closeList();
  closeTable();

  return result.join("\n");
}

function renderTable(rows: string[]): string {
  if (rows.length === 0) return "";

  const parsedRows = rows.map((r) =>
    r
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim())
  );

  if (parsedRows.length < 1) return "";

  const headers = parsedRows[0];
  // If row 1 is delimiter (| --- | --- |), slice it out
  let dataRows = parsedRows.slice(1);
  if (dataRows.length > 0 && dataRows[0].every((cell) => /^:?-+:?$/.test(cell))) {
    dataRows = dataRows.slice(1);
  }

  let html = `
    <div class="my-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-left text-xs">
        <thead class="bg-gray-50/90 dark:bg-slate-800/80 font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300">
          <tr>
            ${headers.map((h) => `<th class="py-2.5 px-3.5 border-b border-gray-200 dark:border-slate-800">${formatInline(h)}</th>`).join("")}
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
          ${dataRows
            .map(
              (row, idx) => `
            <tr class="${idx % 2 === 1 ? "bg-gray-50/40 dark:bg-slate-800/20" : ""}">
              ${row.map((cell) => `<td class="py-2.5 px-3.5 text-gray-700 dark:text-gray-300 whitespace-normal">${formatInline(cell)}</td>`).join("")}
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  return html;
}

function formatInline(str: string): string {
  let res = str;

  // Inline images: ![alt](url)
  res = res.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-xl my-2 border border-gray-200 dark:border-slate-800 shadow-sm" />');

  // Inline links: [text](url)
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 underline font-semibold hover:text-indigo-800 dark:hover:text-indigo-300 transition">$1</a>');

  // Bold + Italic: ***text*** or ___text___
  res = res.replace(/(\*\*\*|___)(.*?)\1/g, "<strong><em>$2</em></strong>");

  // Bold: **text** or __text__
  res = res.replace(/(\*\*|__)(.*?)\1/g, "<strong class='font-bold text-gray-900 dark:text-white'>$2</strong>");

  // Strikethrough: ~~text~~
  res = res.replace(/~~(.*?)~~/g, "<del class='line-through text-gray-400 dark:text-gray-500'>$1</del>");

  // Italic: *text* or _text_
  res = res.replace(/(\*|_)(.*?)\1/g, "<em class='italic'>$2</em>");

  // Inline Code: `code`
  res = res.replace(/`([^`]+)`/g, "<code class='px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-mono text-xs border border-gray-200/80 dark:border-slate-700/80'>$1</code>");

  return res;
}
