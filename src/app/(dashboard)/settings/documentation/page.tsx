"use client";

import { useEffect, useState } from "react";

const METHOD_COLORS: Record<string, string> = {
  get:    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  post:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  patch:  "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  put:    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  delete: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

interface EndpointOp {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: { name: string; in: string; required?: boolean; schema?: { type: string; enum?: string[]; default?: any }; description?: string; example?: any }[];
  requestBody?: {
    required?: boolean;
    content?: {
      "application/json"?: {
        schema?: {
          type?: string;
          required?: string[];
          properties?: Record<string, { type: string; example?: any; enum?: string[]; description?: string }>;
        };
      };
    };
  };
  responses?: Record<string, { description: string; content?: any }>;
}

export default function DocumentationPage() {
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/openapi")
      .then((r) => r.json())
      .then((d) => {
        setSpec(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function getCurlSnippet(method: string, path: string, op: EndpointOp) {
    const fullPath = `/api${path}`;
    let cmd = `curl -X ${method.toUpperCase()} "https://localhost:3333${fullPath}" \\\n  -H "Authorization: Bearer bp_<your_api_key>"`;

    if (op.requestBody?.content?.["application/json"]?.schema?.properties) {
      const props = op.requestBody.content["application/json"].schema.properties;
      const exampleObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(props)) {
        exampleObj[k] = v.example !== undefined ? v.example : v.type === "string" ? "string" : v.type === "integer" ? 1 : true;
      }
      cmd += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(exampleObj, null, 2)}'`;
    }

    return cmd;
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Documentation</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Live OpenAPI 3.0 specification & endpoint reference</p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 animate-pulse">
              <div className="h-4 w-48 bg-gray-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">API Documentation</h1>
        <p className="text-sm text-rose-500">Failed to load OpenAPI specification.</p>
      </div>
    );
  }

  const paths = spec.paths as Record<string, Record<string, EndpointOp>>;
  const grouped: Record<string, { method: string; path: string; op: EndpointOp }[]> = {};

  for (const [path, methods] of Object.entries(paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      const tag = op.tags?.[0] ?? "Other";
      if (!grouped[tag]) grouped[tag] = [];
      grouped[tag].push({ method, path, op });
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              API Documentation & Reference
            </h1>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              v{spec.info?.version || "1.0.0"}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {spec.info?.description || "Interactive OpenAPI 3.0 / Swagger reference"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/openapi"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-gray-700 dark:text-gray-300 rounded-lg transition"
          >
            <span>Raw JSON Spec</span>
            <span>↗</span>
          </a>
        </div>
      </div>

      {/* API Key Authentication Guide Banner */}
      <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <span className="text-xl">🔑</span>
          <div className="flex-1 text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
            <h3 className="font-bold text-sm text-indigo-900 dark:text-indigo-100 mb-1">
              Authentication for 3rd Party Apps & Automations
            </h3>
            <p>
              All endpoints accept programmatic requests using an API Key. Generate an API Key under{" "}
              <a href="/settings/api-access" className="underline font-semibold hover:text-indigo-600 dark:hover:text-indigo-300">
                Settings → API Access
              </a>{" "}
              and provide it in the HTTP headers:
            </p>
            <div className="mt-2 bg-slate-900 text-emerald-400 font-mono p-2.5 rounded-lg text-xs overflow-x-auto">
              Authorization: Bearer bp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
            </div>
          </div>
        </div>
      </div>

      {/* Endpoints List Grouped by Tag */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([tag, endpoints]) => (
          <div
            key={tag}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
          >
            {/* Tag Header */}
            <div className="px-6 py-3.5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/60 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                {tag}
              </h2>
              <span className="text-xs font-medium text-gray-400">
                {endpoints.length} {endpoints.length === 1 ? "endpoint" : "endpoints"}
              </span>
            </div>

            {/* Endpoints inside Tag */}
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {endpoints.map(({ method, path, op }) => {
                const id = `${method}:${path}`;
                const isOpen = expanded === id;
                const reqProps = op.requestBody?.content?.["application/json"]?.schema?.properties;
                const reqRequired = op.requestBody?.content?.["application/json"]?.schema?.required || [];
                const curlCmd = getCurlSnippet(method, path, op);

                return (
                  <div key={id} className="transition-colors">
                    {/* Endpoint Accordion Header */}
                    <button
                      onClick={() => setExpanded(isOpen ? null : id)}
                      className="w-full flex items-center gap-3 px-6 py-4 hover:bg-gray-50/80 dark:hover:bg-slate-800/40 text-left transition"
                    >
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase border ${
                          METHOD_COLORS[method] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {method}
                      </span>
                      <code className="text-xs font-mono font-bold text-gray-900 dark:text-white">
                        /api{path}
                      </code>
                      <span className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-md hidden sm:inline">
                        — {op.summary}
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-400 ml-auto flex-shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-indigo-500" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>

                    {/* Expanded Details */}
                    {isOpen && (
                      <div className="px-6 pb-6 pt-2 space-y-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/40 dark:bg-slate-900/40">
                        {/* Description */}
                        {op.description && (
                          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
                            {op.description}
                          </p>
                        )}

                        {/* Parameters */}
                        {op.parameters && op.parameters.length > 0 && (
                          <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">
                              Parameters
                            </h4>
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden divide-y divide-gray-100 dark:divide-slate-700/60">
                              {op.parameters.map((p) => (
                                <div key={p.name} className="px-4 py-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{p.name}</span>
                                    <span className="text-[10px] uppercase font-semibold text-gray-400 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                      {p.in}
                                    </span>
                                    {p.required && (
                                      <span className="text-[10px] text-rose-500 font-bold">required</span>
                                    )}
                                  </div>
                                  <span className="text-gray-500 dark:text-slate-400">
                                    {p.description || (p.schema?.type ? `Type: ${p.schema.type}` : "")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Request Body */}
                        {reqProps && (
                          <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">
                              Request Body (application/json)
                            </h4>
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3.5 space-y-2">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                {Object.entries(reqProps).map(([propName, propDef]) => {
                                  const isReq = reqRequired.includes(propName);
                                  return (
                                    <div key={propName} className="p-2 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-800">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                                          {propName}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] text-gray-400 font-mono">{propDef.type}</span>
                                          {isReq && <span className="text-[10px] text-rose-500 font-bold">*required</span>}
                                        </div>
                                      </div>
                                      {propDef.example !== undefined && (
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                          Example: <code className="text-emerald-600 dark:text-emerald-400 font-mono">{JSON.stringify(propDef.example)}</code>
                                        </div>
                                      )}
                                      {propDef.enum && (
                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                          Options: {propDef.enum.join(", ")}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* cURL Example */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                              Example cURL Request
                            </h4>
                            <button
                              onClick={() => handleCopy(curlCmd, id)}
                              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                            >
                              {copiedId === id ? "✓ Copied!" : "Copy cURL"}
                            </button>
                          </div>
                          <pre className="bg-slate-900 text-gray-200 p-3.5 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed border border-slate-800">
                            {curlCmd}
                          </pre>
                        </div>

                        {/* Responses */}
                        {op.responses && (
                          <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">
                              Responses
                            </h4>
                            <div className="space-y-1.5">
                              {Object.entries(op.responses).map(([code, res]) => (
                                <div
                                  key={code}
                                  className="flex items-center gap-2.5 text-xs bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700"
                                >
                                  <span
                                    className={`font-mono font-extrabold px-1.5 py-0.5 rounded text-[11px] ${
                                      code.startsWith("2")
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : code.startsWith("4") || code.startsWith("5")
                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {code}
                                  </span>
                                  <span className="text-gray-700 dark:text-slate-300 font-medium">
                                    {res.description}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
