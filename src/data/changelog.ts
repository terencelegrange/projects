/**
 * Changelog entries for the Boilerplate app.
 *
 * INSTRUCTIONS FOR CLAUDE:
 * When you complete a feature or make a significant change, add a new entry
 * to the TOP of this array (most recent first). Use today's actual date.
 * initDb() will sync these to the `changelog` DB table on next startup.
 *
 * Format: { date: "YYYY-MM-DD", description: "Short description of the change" }
 */
export const CHANGELOG: { date: string; description: string }[] = [
  { date: "2026-08-14", description: "Added vertical priority drag-and-drop reordering in Kanban board (highest cards have biggest priority) with visual drop insertion indicators and 1-click priority dropdown badges" },
  { date: "2026-08-14", description: "Updated full OpenAPI 3.0 Swagger specifications with request body schemas, parameters, response codes, copyable cURL snippets, and validated 3rd party API key project/issue workflows" },
  { date: "2026-08-14", description: "Launched Project Management platform with Projects hub, interactive Kanban boards with drag-and-drop, filterable list views, issue detail drawer with comments, and workspace analytics" },
  { date: "2026-08-04", description: "Removed site monitoring / health-check feature and environment selector to restore this as a generic app template" },
  { date: "2026-06-27", description: "Add dedicated profile page with identity and password change cards; simplify top-right dropdown to navigation links" },
  { date: "2026-06-26", description: "Replaced profile modal with inline top-bar dropdown; added avatar display, randomizer, and inline profile editing" },
  { date: "2026-06-26", description: "Moved dark mode toggle from sidebar to top bar next to profile dropdown" },
  { date: "2026-05-30", description: "Updated platform server and dev port configuration to 3333" },
  { date: "2026-03-30", description: "Added API Access tab in Settings — generate named API keys with contact, optional expiry, revoke/delete; keys authenticate via Authorization: Bearer header" },
  { date: "2026-03-30", description: "Added RBAC — viewer, editor, admin roles with configurable nav permissions; Roles tab in Settings with permission matrix" },
  { date: "2026-03-30", description: "Added Settings overview tiles — All Users, New Registrations, and Recent Activity summary cards" },
  { date: "2026-03-30", description: "Added Changelog tab to Settings — development changes tracked in DB and displayed as dated list" },
  { date: "2026-03-30", description: "Added OpenAPI 3.0 documentation tab to Settings — live spec viewer grouped by tag with expandable endpoints" },
  { date: "2026-03-30", description: "Added Feature Flags tab to Settings — toggle switches for signup, dashboard, and menu with immediate enforcement" },
  { date: "2026-03-30", description: "Added profile tile in top-right header — edit name, email, and password with current password verification" },
  { date: "2026-03-30", description: "Consolidated Settings into tabbed layout — Users, Audit Log, Feature Flags, and Documentation in one page" },
  { date: "2026-03-30", description: "Removed standalone Audit Log nav item — audit browser moved into Settings tabs" },
  { date: "2026-03-30", description: "Added audit log viewer with search, action filter, and pagination" },
  { date: "2026-03-30", description: "Added dark/light mode toggle — preference persisted to database and applied server-side via bp_theme cookie" },
  { date: "2026-03-30", description: "Added Settings page — user management with approve, reject, revoke, re-approve, delete, and role assignment" },
  { date: "2026-03-30", description: "Added Dashboard page — stat tiles (total, approved, pending users, audit events) and recent registrations" },
  { date: "2026-03-30", description: "Added user registration with admin approval flow — new accounts start as pending" },
  { date: "2026-03-30", description: "Initial boilerplate setup — Next.js 15, Tailwind CSS, MySQL via Prisma, JWT auth, audit logging" },
];
