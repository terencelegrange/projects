# Project Management Platform — Architecture & Developer Guide

## Architecture Overview

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v3 (`darkMode: "class"`) · Prisma 5 + MySQL · JWT (`jose`) · Web Crypto API (`crypto.subtle`) · bcryptjs  
**Port:** 3333 (dev and production)  
**Database:** `projects` MySQL schema (`mysql://terence:melissa8@192.168.100.204:3306/projects`)  
**Base Repository:** `http://192.168.100.252:3000/terence/boilerplate.git`

---

## Directory Structure

```
src/
  app/
    (dashboard)/                # Authenticated application layout
      page.tsx                  # Workspace Dashboard (active projects, my issues, metrics)
      projects/
        page.tsx                # Projects Hub (workspace cards, search, creation modal)
        [key]/page.tsx          # Project Workspace (Kanban Board with drag-and-drop & List view)
      settings/
        page.tsx                # Settings Overview cards
        users/page.tsx          # User management & approvals
        roles/page.tsx          # Role-Based Access Control (RBAC) permission matrix
        feature-flags/page.tsx  # Feature flag toggles
        api-access/page.tsx     # API Key generation (bp_...) & revocation
        project-statuses/page.tsx # Custom per-board workflow stages & 1-N column ordering
        issue-types/page.tsx    # Custom issue types, icons, colors, & default assignment
        audit/page.tsx          # Paginated audit log browser
        documentation/page.tsx  # Interactive OpenAPI 3.0 documentation & cURL generator
        changelog/page.tsx      # System changelog synced with database
      profile/page.tsx          # User profile editing & password change
      audit/page.tsx            # Legacy audit route
      layout.tsx                # Dashboard shell: Sidebar, top navigation, theme toggle
    api/
      projects/
        route.ts                # GET (list with stats), POST (create project)
        [key]/
          route.ts              # GET (by key), PATCH (update), DELETE (cascade)
          attributes/route.ts   # GET (variables), POST (upsert variable), DELETE (remove)
          issues/route.ts       # GET (filtered project issues), POST (create issue)
          statuses/route.ts     # GET (list 1-N stages), POST (add stage), PUT (reorder)
          statuses/[id]/route.ts# PATCH (edit stage), DELETE (delete & migrate)
      issues/
        [id]/
          route.ts              # GET, PATCH (status/priority/position), DELETE (by ID or KEY)
          comments/route.ts     # GET (comments thread), POST (add comment/response)
      issue-types/
        route.ts                # GET (list types), POST (create type)
        [id]/route.ts           # PATCH (update type/key), DELETE (delete & migrate)
      events/
        route.ts                # GET (query events stream with filters)
        [id]/route.ts           # GET (specific event payload)
      webhooks/
        route.ts                # GET (list webhooks), POST (register webhook)
        [id]/
          route.ts              # GET, PATCH (update/toggle), DELETE
          test/route.ts         # POST (send test ping)
          deliveries/route.ts   # GET (view delivery logs)
      labels/route.ts           # GET (list labels), POST (create label)
      api-keys/
        route.ts                # GET (list keys), POST (generate bp_... API key)
        [id]/route.ts           # PATCH (toggle active), DELETE (revoke key)
      dashboard/route.ts        # GET (workspace statistics & assigned task queue)
      auth/
        login/route.ts          # POST (email/password -> sets bp_token & bp_theme)
        logout/route.ts         # POST (clears cookie)
        signup/route.ts         # POST (register pending account)
      me/
        profile/route.ts        # GET (user profile), PATCH (update identity & password)
        theme/route.ts          # PATCH (toggle dark/light mode)
      users/
        route.ts                # GET (all users)
        [id]/route.ts           # PATCH (role/status), DELETE (remove user)
      rbac/
        route.ts                # GET (permission matrix), PUT (update permissions)
        me/route.ts             # GET (current user allowed nav keys)
      statuses/route.ts         # GET (effective status labels), PUT (update mappings), DELETE (reset)
      feature-flags/
        route.ts                # GET (all flags)
        [key]/route.ts          # PATCH (toggle flag)
      audit/route.ts            # GET (paginated audit logs)
      changelog/route.ts        # GET (changelog history)
      openapi/route.ts          # GET (OpenAPI 3.0 specification JSON)
    login/page.tsx              # Login page
    signup/page.tsx             # User registration
    layout.tsx                  # Root layout (SSR theme application via bp_theme)
    globals.css                 # Global styling & Tailwind utilities
  components/
    IssueDetailDrawer.tsx       # Slide-over drawer (title, description, priority, comments feed)
    NewIssueModal.tsx           # Quick issue creation modal
  data/
    nav.ts                      # Sidebar navigation items and role permissions
    changelog.ts                # Static changelog source of truth synced on startup
  lib/
    prisma.ts                   # Singleton PrismaClient instance
    auth.ts                     # JWT & API Key authentication (Web Crypto API Edge-safe)
    initDb.ts                   # DDL table creation, migration checks, starter seeds
    audit.ts                    # auditLog() helper (asynchronous, non-throwing)
    flags.ts                    # isFlagEnabled() helper
  middleware.ts                 # Route protection; delegates /api Bearer tokens to route handlers
prisma/
  schema.prisma                 # Full Prisma ORM schema definition
```

---

## Database Architecture & Models

The database contains 11 core tables managed via Prisma and `src/lib/initDb.ts`:

| Model / Table | Key Columns | Purpose |
|---|---|---|
| `users` | `id`, `email`, `password_hash`, `name`, `role`, `status`, `theme`, `avatar` | User accounts, roles (`viewer`, `editor`, `admin`), and approval status (`pending`, `approved`, `rejected`). |
| `projects` | `id`, `key` (UNIQUE), `name`, `description`, `color`, `icon`, `lead_id` | Top-level project workspaces with team leads and custom accents. |
| `project_statuses` | `id`, `project_id`, `key`, `name`, `order`, `color`, `is_done` | Per-project customizable workflow stages with sequential 1-N ordering. |
| `project_attributes` | `id`, `project_id`, `key`, `value`, `created_at`, `updated_at` | Dynamic key-value variables & attributes (e.g. `REPO`, `DOCS`, `CI_CD`) per project workspace. |
| `issue_types` | `id`, `key` (UNIQUE), `name`, `icon`, `color`, `description`, `is_default` | Global customizable issue types, symbols/emojis, colors, and defaults. |
| `issues` | `id`, `project_id`, `issue_number`, `title`, `description`, `status`, `priority`, `type`, `position`, `assignee_id`, `reporter_id`, `estimate`, `due_date` | Work items. Composite unique constraint `[project_id, issue_number]` for sequential keys (`CORE-1`, `CORE-2`). |
| `issue_comments` | `id`, `issue_id`, `user_id`, `content`, `created_at` | Threaded discussions and automated bot updates on issues. |
| `labels` | `id`, `name`, `color`, `project_id` | Categorization tags for issues. |
| `issue_labels` | `issue_id`, `label_id` (Composite PK) | Many-to-many link between issues and labels. |
| `api_keys` | `id`, `key_hash` (SHA-256), `prefix`, `name`, `contact`, `expires_at`, `created_by`, `active`, `last_used` | Programmatic API keys (`bp_...`) for 3rd-party integration. |
| `role_permissions` | `role`, `nav_key` (Composite PK) | Role-Based Access Control matrix for sidebar navigation. |
| `feature_flags` | `key` (PK), `enabled`, `label`, `description` | Runtime toggles (`signup`, `dashboard`, `menu`, `projects`). |
| `custom_statuses` | `key` (PK), `label`, `color`, `created_at`, `updated_at` | Custom display label mappings for standard workflow statuses. |
| `system_events` | `id`, `event_id` (UNIQUE), `event_type`, `action`, `resource_type`, `resource_key`, `project_key`, `payload` | Immutable chronological event stream with hypermedia API links. |
| `webhooks` | `id`, `name`, `url`, `secret`, `events`, `project_id`, `active` | Webhook subscriptions with project scope, event filters, and HMAC secrets. |
| `webhook_deliveries` | `id`, `webhook_id`, `event_id`, `event_type`, `payload`, `response_status`, `duration_ms`, `error` | Outbound HTTP delivery audit log with status codes and latency. |
| `audit_logs` | `id`, `user_id`, `action`, `resource`, `resource_id`, `details`, `ip`, `created_at` | Audit trail of all database mutations. |
| `changelog` | `id`, `date`, `description`, `created_at` | Development history synced from `src/data/changelog.ts`. |

---

## Authentication & 3rd-Party API Integration

The platform provides dual-mode authentication in [`src/lib/auth.ts`](file:///Users/terence/development/projects/src/lib/auth.ts):

### 1. Browser Sessions (Cookie-Based JWT)
- Login issues an `httpOnly`, `SameSite` JWT cookie (`bp_token`) signed with HS256 (7-day validity).
- Theme preference is stored in `bp_theme` for SSR dark mode rendering.

### 2. Programmatic 3rd-Party API Keys (Bearer Tokens)
- Generated in **Settings → API Access** (`/settings/api-access`) or via `POST /api/api-keys`.
- Keys are 32 random hex characters prefixed with `bp_` (e.g. `bp_a1b2c3d4e5f6...`).
- Stored exclusively as **SHA-256 hashes** in the `api_keys` table.
- Pass in HTTP header: `Authorization: Bearer bp_<your_api_key>`.
- Inherits admin capabilities of the creator for full CRUD on projects and issues.
- Implementation uses standard `crypto.subtle.digest("SHA-256", ...)` for zero Edge runtime warnings.

---

## Complete REST API Reference

All endpoints accept `Authorization: Bearer <api_key>` or browser session cookies.

### 1. Projects API
- `GET /api/projects` — List all projects with progress stats, issue counts, lead info, and dynamic attributes list/map.
- `POST /api/projects` — Create project workspace (`{ name, key, description, color, lead_id, attributes }`).
- `GET /api/projects/{key}` — Retrieve specific project details by unique uppercase key (includes `attributes` array and `attributesMap`).
- `PATCH /api/projects/{key}` — Update project name, description, color, lead, or sync `attributes`.
- `DELETE /api/projects/{key}` — Delete project and cascade-delete all issues, comments, statuses, and attributes.

### 2. Project Variables & Attributes API
- `GET /api/projects/{key}/attributes` — List all dynamic key-value variables configured for a project.
- `POST /api/projects/{key}/attributes` — Add or upsert a variable (`{ key: "REPO", value: "https://..." }`).
- `DELETE /api/projects/{key}/attributes?key=...` or `?id=...` — Delete a specific attribute.

### 3. Project Statuses & Workflows API
- `GET /api/projects/{key}/statuses` — List all workflow status stages for a project ordered by 1 to N position.
- `POST /api/projects/{key}/statuses` — Add a new status stage (`{ name, key, color, order, is_done }`).
- `PUT /api/projects/{key}/statuses` — Batch re-order statuses via array of IDs (`{ statusIds: [4, 1, 2, 3] }`).
- `PATCH /api/projects/{key}/statuses/{id}` — Edit status name, color, key, or `is_done` flag.
- `DELETE /api/projects/{key}/statuses/{id}?migrateToKey=...` — Delete status and migrate any active issues safely.

### 3. Issues & Board Workflows API
- `GET /api/projects/{key}/issues` — List issues in a project with filtering (`search`, `status`, `priority`, `type`, `assigneeId`). Returns issues sorted by priority hierarchy and vertical position.
- `POST /api/projects/{key}/issues` — Create an issue (defaults to project's `order: 1` status if omitted).
- `GET /api/issues/{id}` — Get issue details by numeric ID (e.g. `2`) or formatted key (e.g. `CORE-2`).
- `PATCH /api/issues/{id}` — Update title, description, status, priority, position, assignee, estimate, or labels.
- `DELETE /api/issues/{id}` — Delete issue by ID or key.

**Supported Statuses:** `backlog` · `todo` · `in_progress` · `in_review` · `done` · `canceled`  
**Supported Priorities:** `urgent` (weight 5) · `high` (4) · `medium` (3) · `low` (2) · `none` (1)  
**Supported Types:** `task` (📋) · `bug` (🐛) · `feature` (✨) · `improvement` (⚡)

### 6. Webhooks & System Events API
- `GET /api/events` — Query chronological events log (`?since=...`, `?projectKey=CORE`, `?eventType=issue.status_changed`, `?action=transition`, `?limit=50`).
- `GET /api/events/{id}` — Retrieve full parsed event payload and hypermedia links by event ID (e.g. `evt_...`).
- `GET /api/webhooks` — List registered webhook subscriptions with delivery counts and last health status.
- `POST /api/webhooks` — Register a webhook endpoint (`{ name, url, secret, events, project_id, active }`).
- `GET /api/webhooks/{id}` — Get webhook details.
- `PATCH /api/webhooks/{id}` — Update webhook configuration or toggle active status.
- `DELETE /api/webhooks/{id}` — Delete webhook subscription.
- `POST /api/webhooks/{id}/test` — Send a test ping payload (`webhook.test`) to verify connectivity.
- `GET /api/webhooks/{id}/deliveries` — Retrieve recent delivery logs, HTTP status codes, latency, and response bodies.

#### Standard Event Payload & Hypermedia API Links
```json
{
  "id": "evt_1723980000_a1b2c3d4",
  "event": "issue.status_changed",
  "action": "transition",
  "timestamp": "2026-08-18T11:15:00.000Z",
  "actor": { "id": 1, "name": "Admin User", "email": "admin@admin.com" },
  "project": { "id": 1, "key": "CORE", "name": "Core Platform" },
  "issue": {
    "id": 15,
    "key": "CORE-3",
    "issue_number": 3,
    "title": "Migrate schema",
    "status": "todo",
    "previous_status": "backlog",
    "priority": "high",
    "type": "task",
    "assignee": { "id": 2, "name": "Terence", "email": "terence@admin.com" }
  },
  "changes": { "status": { "from": "backlog", "to": "todo" } },
  "api_urls": {
    "issue": "/api/issues/CORE-3",
    "issue_comments": "/api/issues/CORE-3/comments",
    "project": "/api/projects/CORE",
    "project_issues": "/api/projects/CORE/issues",
    "project_statuses": "/api/projects/CORE/statuses",
    "project_attributes": "/api/projects/CORE/attributes"
  }
}
```

### 7. Issue Comments & Discussions API
- `GET /api/issues/{id}/comments` — Retrieve full comment thread for an issue (accepts ID or Key like `CORE-2`).
- `POST /api/issues/{id}/comments` — Post a response/comment (`{ content: "..." }`).

### 6. Labels API
- `GET /api/labels` — List issue labels (optional `?projectId=` filter).
- `POST /api/labels` — Create a label (`{ name, color, project_id }`).

### 5. API Keys Management
- `GET /api/api-keys` — List all generated API keys (admin only).
- `POST /api/api-keys` — Generate a new API key (`{ name, contact, expiresAt }`). Plaintext key returned once.
- `PATCH /api/api-keys/{id}` — Toggle active status (`{ active: boolean }`).
- `DELETE /api/api-keys/{id}` — Revoke and delete API key.

### 6. Dashboard & Analytics API
- `GET /api/dashboard` — High-level statistics (total users, projects, open tasks, completion rate, assigned to me queue).

### 7. Users & RBAC API
- `GET /api/users` — List all registered users (admin only).
- `PATCH /api/users/{id}` — Update role (`viewer`, `editor`, `admin`) or status (`approved`, `rejected`, `pending`).
- `DELETE /api/users/{id}` — Delete user account.
- `GET /api/rbac` — Get role permission matrix.
- `PUT /api/rbac` — Replace role permissions.
- `GET /api/rbac/me` — Allowed nav keys for currently authenticated user.

### 8. Workflow Statuses & Custom Labels API
- `GET /api/statuses` — Returns all workflow statuses with custom display labels (or system defaults) and lookup map.
- `PUT /api/statuses` — Update custom status display names (`{ mappings: { backlog: "Feature Ideation", ... } }`).
- `DELETE /api/statuses` — Reset all status mappings back to system defaults.

### 9. Feature Flags & Audit API
- `GET /api/feature-flags` — List all feature flags.
- `PATCH /api/feature-flags/{key}` — Toggle feature flag (`{ enabled: boolean }`).
- `GET /api/audit` — Paginated audit log (`?page=1&limit=25&action=...`).
- `GET /api/changelog` — Development changelog history.
- `GET /api/openapi` — OpenAPI 3.0 JSON specification.

### 10. Auth & Profile API
- `POST /api/auth/login` — Authenticate with email and password.
- `POST /api/auth/logout` — Invalidate session cookie.
- `POST /api/auth/signup` — Register new account (starts in `pending` state).
- `GET /api/me/profile` — Get profile data.
- `PATCH /api/me/profile` — Update name, email, avatar, or password.
- `PATCH /api/me/theme` — Update theme preference (`dark` | `light`).

---

## Kanban Board & Priority Drag-and-Drop System

The Kanban workspace ([`src/app/(dashboard)/projects/[key]/page.tsx`](file:///Users/terence/development/projects/src/app/%28dashboard%29/projects/%5Bkey%5D/page.tsx)) features:

1. **Vertical Priority Ordering**:
   - Within every column, issues are sorted with the **highest priority at the top**: `Urgent` ➔ `High` ➔ `Medium` ➔ `Low` ➔ `None`.
   - Secondary sorting uses fractional `position` (`position ASC`) for fine-grained reordering.

2. **Drag & Drop Capabilities**:
   - Dragging a card to the top of a column automatically promotes its priority to **Urgent** (`priority = "urgent"`).
   - Dragging over cards displays an indigo insertion line (`above` or `below`). Dropping sets the card to that exact position and inherits the target priority tier.
   - Dragging across columns updates both workflow status and priority in one step.

3. **1-Click Priority Dropdown on Cards**:
   - Every card has an interactive priority badge with a dropdown menu, allowing instant priority changes and automatic re-ranking.

---

## Developer Workflows & Rules

### 1. Changelog Maintenance (REQUIRED)
Every time a feature or significant change is completed:
1. Add a new entry to the top of the `CHANGELOG` array in [`src/data/changelog.ts`](file:///Users/terence/development/projects/src/data/changelog.ts) with today's date.
2. `initDb()` automatically syncs new entries into the MySQL `changelog` table on startup.

### 2. OpenAPI Spec Maintenance (REQUIRED)
When creating or modifying an API route:
1. Update [`src/app/api/openapi/route.ts`](file:///Users/terence/development/projects/src/app/api/openapi/route.ts) with full schemas, parameters, request body properties, and response codes.
2. The live spec viewer in **Settings → Documentation** (`/settings/documentation`) automatically renders updated schemas and copyable cURL commands.

### 3. Navigation & RBAC Maintenance
When adding a new page:
1. Add the item to `NAV_ITEMS` in [`src/data/nav.ts`](file:///Users/terence/development/projects/src/data/nav.ts).
2. Assign default allowed roles in `DEFAULT_ROLE_PERMISSIONS`.
3. `initDb()` will seed the new permissions via `INSERT IGNORE`.

### 4. Build & Validation Commands
```bash
# Generate Prisma Client
npx prisma generate

# Type check
npx tsc --noEmit

# Production Build
npm run build

# Start local server
npm run dev
```

---

## Docker / Deployment

- `next.config.ts` has `output: "standalone"` for Docker builds
- `Dockerfile` is the same multi-stage pattern as mysql-gui/finance-web (deps → builder with `prisma generate` + `npm run build` → slim runner running as non-root `nextjs` user on port 3333)
- `docker-compose.yml` publishes host port `3042` → container `3333`, loads secrets from `projects.env` (not `.env` — see file comment)

---

## Proxmox Deployment Infrastructure

Shared context for anyone (human or Claude) touching CI/CD for this app or its siblings (mysql-gui, finance-web, calendar, pixxel, lego-collection, ...) on the same Proxmox host. Duplicated verbatim across each app's `CLAUDE.md` — no single canonical copy, keep them in sync if this changes.

### Current deploy target
- **Host:** `192.168.100.228` (Proxmox VM, user `terence`).
- **Port `3042`** — picked after checking what's already taken on this box (5200 mysql-gui, 3010 finance-web, 3020 calendar, 3030 pixxel, 3040/3041 rainyday-admin/app, 3200 lego-collection). Always check `docker ps --format '{{.Names}}: {{.Ports}}'` on the host before assuming a port is free — this box accumulates apps fast.
- **Jenkins:** `http://192.168.100.151:8080`. **Gitea:** `http://192.168.100.252:3000`.

### SSH / deploy key
- Credential ID `PROXMOX_APPS_KEY` (Jenkins → Manage Credentials), kind "SSH Username with private key", username `terence`. Shared across every app deployed to this host.
- New app home dirs on `.228` don't exist by default — pre-create as root: `mkdir -p /home/<app> && chown terence:terence /home/<app>` before first deploy.
- `terence` must be in the `docker` group, and Compose v2 must be installed system-wide (`/usr/local/lib/docker/cli-plugins/docker-compose`), not per-user — both already fixed on this host.

### Jenkins pipeline pattern (declarative)
- `checkout scm` (Gitea, credential `PIXXEL_GITEA_CRED`) → write env file via `withCredentials` (Jenkins string credentials, prefixed `PROJECTS_*`) → `sshagent(['PROXMOX_APPS_KEY'])` for `mkdir`+`scp` the env file, `rsync` the code, remote `ssh` running `docker compose build && docker compose up -d`, then a polling health-check stage against `/login`.
- **Webhook token must live in the `Jenkinsfile` itself** — the declarative `triggers { GenericTrigger(token: '...') }` block is what Jenkins re-syncs into the job config on every build; editing the token via the UI alone doesn't stick.
- **Check for duplicate webhooks before creating one**: `curl -H "Authorization: token $GITEA_TOKEN" http://192.168.100.252:3000/api/v1/repos/terence/<repo>/hooks`. Duplicates mean every push fires N simultaneous builds, which has stalled this box before under disk/CPU contention.
- **Watch for a wedged Docker daemon on this host** — it has happened before (a build's `npm ci` container exits successfully but the daemon never proceeds to the next layer, for 45+ minutes). Check `uptime`/`docker info` before triggering a build if a prior one seems stuck; a genuinely wedged daemon needs a restart, not a longer timeout.

### Secrets
Jenkins global string credentials, one per secret, prefixed by app: `PROJECTS_DATABASE_URL`, `PROJECTS_JWT_SECRET`, `PROJECTS_ADMIN_EMAIL`, `PROJECTS_ADMIN_PASSWORD_HASH`. Values match this app's local `.env` (same MySQL host `.204`, database `projects`, already-existing schema with real data — not seeded fresh by the pipeline). Planned migration to the in-house secret manager (`http://192.168.100.208:3333`) is tracked in mysql-gui's/finance-web's `CLAUDE.md`.
