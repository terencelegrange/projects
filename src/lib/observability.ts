import { prisma } from "./prisma";
import { initDb } from "./initDb";

export interface ObservabilityRow {
  type: "analytics" | "logcollector";
  enabled: number | boolean;
  endpoint: string;
  api_key: string | null;
  site_id: string | null;
  log_level: string | null;
  custom_headers: string | null;
  updated_at?: Date | string;
}

export interface ObservabilityConfig {
  type: "analytics" | "logcollector";
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  siteId: string;
  logLevel: string;
  customHeaders: Record<string, string>;
  updatedAt?: string;
}

function parseHeaders(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getObservabilityConfigs(): Promise<Record<string, ObservabilityConfig>> {
  await initDb();
  const rows = await prisma.$queryRaw<ObservabilityRow[]>`
    SELECT \`type\`, \`enabled\`, \`endpoint\`, \`api_key\`, \`site_id\`, \`log_level\`, \`custom_headers\`, \`updated_at\`
    FROM \`observability_config\`
  `;

  const map: Record<string, ObservabilityConfig> = {};
  for (const r of rows) {
    map[r.type] = {
      type: r.type,
      enabled: Boolean(r.enabled),
      endpoint: r.endpoint || "",
      apiKey: r.api_key || "",
      siteId: r.site_id || "projects",
      logLevel: r.log_level || "info",
      customHeaders: parseHeaders(r.custom_headers),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    };
  }

  // Ensure default fallbacks if table was empty
  if (!map.analytics) {
    map.analytics = {
      type: "analytics",
      enabled: false,
      endpoint: "http://192.168.100.228:8030/api/collect",
      apiKey: "",
      siteId: "projects",
      logLevel: "info",
      customHeaders: {},
    };
  }
  if (!map.logcollector) {
    map.logcollector = {
      type: "logcollector",
      enabled: false,
      endpoint: "http://192.168.100.228:8020/ingest",
      apiKey: "",
      siteId: "projects",
      logLevel: "info",
      customHeaders: {},
    };
  }

  return map;
}

export async function saveObservabilityConfig(
  type: "analytics" | "logcollector",
  config: Partial<ObservabilityConfig>
): Promise<ObservabilityConfig> {
  await initDb();

  const current = (await getObservabilityConfigs())[type];
  const merged = {
    enabled: config.enabled !== undefined ? config.enabled : current.enabled,
    endpoint: config.endpoint !== undefined ? config.endpoint.trim() : current.endpoint,
    apiKey: config.apiKey !== undefined ? config.apiKey.trim() : current.apiKey,
    siteId: config.siteId !== undefined ? config.siteId.trim() : current.siteId,
    logLevel: config.logLevel !== undefined ? config.logLevel.trim() : current.logLevel,
    customHeaders: config.customHeaders !== undefined ? JSON.stringify(config.customHeaders) : JSON.stringify(current.customHeaders),
  };

  await prisma.$executeRaw`
    INSERT INTO \`observability_config\` (\`type\`, \`enabled\`, \`endpoint\`, \`api_key\`, \`site_id\`, \`log_level\`, \`custom_headers\`, \`updated_at\`)
    VALUES (${type}, ${merged.enabled ? 1 : 0}, ${merged.endpoint}, ${merged.apiKey}, ${merged.siteId}, ${merged.logLevel}, ${merged.customHeaders}, NOW())
    ON DUPLICATE KEY UPDATE
      \`enabled\` = VALUES(\`enabled\`),
      \`endpoint\` = VALUES(\`endpoint\`),
      \`api_key\` = VALUES(\`api_key\`),
      \`site_id\` = VALUES(\`site_id\`),
      \`log_level\` = VALUES(\`log_level\`),
      \`custom_headers\` = VALUES(\`custom_headers\`),
      \`updated_at\` = NOW()
  `;

  return (await getObservabilityConfigs())[type];
}

export async function sendRemoteLog(entry: {
  level?: string;
  message: string;
  statusCode?: number;
  method?: string;
  path?: string;
  service?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}): Promise<void> {
  try {
    const configs = await getObservabilityConfigs();
    const config = configs.logcollector;
    if (!config || !config.enabled || !config.endpoint) return;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.customHeaders,
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const payload = {
      level: entry.level || config.logLevel || "info",
      message: entry.message,
      status_code: entry.statusCode || 200,
      method: entry.method || "INTERNAL",
      path: entry.path || "/internal",
      service: entry.service || config.siteId || "projects",
      metadata: entry.metadata || {},
      timestamp: entry.timestamp || new Date().toISOString(),
    };

    fetch(config.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }).catch(() => {
      // Fail silently
    });
  } catch {
    // Fail silently
  }
}

export async function sendAnalyticsEvent(event: {
  eventName: string;
  url?: string;
  props?: Record<string, unknown>;
}): Promise<void> {
  try {
    const configs = await getObservabilityConfigs();
    const config = configs.analytics;
    if (!config || !config.enabled || !config.endpoint) return;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.customHeaders,
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const payload = {
      site_id: config.siteId || "projects",
      event: event.eventName,
      url: event.url || "backend://projects",
      props: event.props || {},
    };

    fetch(config.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }).catch(() => {
      // Fail silently
    });
  } catch {
    // Fail silently
  }
}
