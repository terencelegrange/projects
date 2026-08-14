import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Project Management Platform API",
    version: "1.2.0",
    description: "Comprehensive REST API for Projects, Kanban Boards, Issue Tracking, Discussions, Labels, and Platform Administration. All endpoints support Authorization: Bearer <api_key> (e.g. bp_...) and cookie sessions.",
    contact: {
      name: "API Support",
      email: "admin@admin.com",
    },
  },
  servers: [
    { url: "/api", description: "Current Environment Server" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "bp_...",
        description: "API key generated in Settings -> API Access (e.g. bp_1234567890abcdef...)",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "bp_token",
        description: "JWT session cookie set upon login",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id:         { type: "integer", example: 1 },
          email:      { type: "string", format: "email", example: "admin@admin.com" },
          name:       { type: "string", nullable: true, example: "Terence" },
          role:       { type: "string", enum: ["viewer", "editor", "admin"], example: "admin" },
          status:     { type: "string", enum: ["pending", "approved", "rejected"], example: "approved" },
          avatar:     { type: "integer", nullable: true, example: 42 },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Project: {
        type: "object",
        properties: {
          id:          { type: "integer", example: 1 },
          key:         { type: "string", example: "CORE" },
          name:        { type: "string", example: "Core Platform" },
          description: { type: "string", nullable: true, example: "Main backend and platform systems" },
          color:       { type: "string", example: "#6366f1" },
          icon:        { type: "string", example: "folder" },
          lead:        { $ref: "#/components/schemas/User" },
          stats: {
            type: "object",
            properties: {
              total:          { type: "integer", example: 12 },
              done:           { type: "integer", example: 5 },
              in_progress:    { type: "integer", example: 3 },
              todo:           { type: "integer", example: 3 },
              backlog:        { type: "integer", example: 1 },
              completionRate: { type: "integer", example: 42 },
            },
          },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      Issue: {
        type: "object",
        properties: {
          id:            { type: "integer", example: 101 },
          key:           { type: "string", example: "CORE-1" },
          issueNumber:   { type: "integer", example: 1 },
          title:         { type: "string", example: "Implement OAuth integration" },
          description:   { type: "string", nullable: true, example: "Support GitHub and Google sign-in." },
          status:        { type: "string", enum: ["backlog", "todo", "in_progress", "in_review", "done", "canceled"], example: "in_progress" },
          priority:      { type: "string", enum: ["urgent", "high", "medium", "low", "none"], example: "high" },
          type:          { type: "string", enum: ["task", "bug", "feature", "improvement"], example: "feature" },
          estimate:      { type: "integer", nullable: true, example: 5 },
          dueDate:       { type: "string", format: "date-time", nullable: true },
          assignee:      { $ref: "#/components/schemas/User" },
          reporter:      { $ref: "#/components/schemas/User" },
          labels:        { type: "array", items: { $ref: "#/components/schemas/Label" } },
          commentsCount: { type: "integer", example: 2 },
          createdAt:     { type: "string", format: "date-time" },
          updatedAt:     { type: "string", format: "date-time" },
        },
      },
      IssueComment: {
        type: "object",
        properties: {
          id:         { type: "integer", example: 1 },
          content:    { type: "string", example: "PR opened for review at #42" },
          user:       { $ref: "#/components/schemas/User" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Label: {
        type: "object",
        properties: {
          id:         { type: "integer", example: 1 },
          name:       { type: "string", example: "frontend" },
          color:      { type: "string", example: "#6366f1" },
          project_id: { type: "integer", nullable: true },
        },
      },
      ApiKey: {
        type: "object",
        properties: {
          id:               { type: "integer", example: 1 },
          prefix:           { type: "string", example: "bp_12345678" },
          name:             { type: "string", example: "CI/CD Integration" },
          contact:          { type: "string", example: "devops@company.com" },
          expires_at:       { type: "string", format: "date-time", nullable: true },
          last_used:        { type: "string", format: "date-time", nullable: true },
          active:           { type: "boolean", example: true },
          created_by_email: { type: "string", nullable: true },
          created_at:       { type: "string", format: "date-time" },
        },
      },
      AuditEntry: {
        type: "object",
        properties: {
          id:          { type: "integer", example: 1 },
          action:      { type: "string", example: "ISSUE_UPDATED" },
          resource:    { type: "string", example: "issue" },
          resource_id: { type: "string", nullable: true, example: "CORE-1" },
          details:     { type: "string", nullable: true, example: "{\"status\":\"in_progress\"}" },
          ip:          { type: "string", nullable: true },
          created_at:  { type: "string", format: "date-time" },
          user_email:  { type: "string", nullable: true },
          user_name:   { type: "string", nullable: true },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string", example: "Invalid request payload" } },
      },
    },
  },
  security: [
    { bearerAuth: [] },
    { cookieAuth: [] },
  ],
  paths: {
    // ── Projects ────────────────────────────────────────────────────────
    "/projects": {
      get: {
        tags: ["Projects"],
        summary: "List all projects",
        description: "Returns all active projects with summary metrics (open issue counts, completion rate, team lead).",
        responses: {
          200: {
            description: "Array of projects",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Project" } } } },
          },
          401: { description: "Unauthorized" },
        },
      },
      post: {
        tags: ["Projects"],
        summary: "Create a project",
        description: "Creates a new project workspace. Project key is unique (e.g. CORE, APP, DEV).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name:        { type: "string", example: "Mobile Application" },
                  key:         { type: "string", example: "MOB", description: "2-10 uppercase alphanumeric chars (auto-generated if omitted)" },
                  description: { type: "string", example: "iOS and Android client applications" },
                  color:       { type: "string", example: "#3b82f6" },
                  lead_id:     { type: "integer", example: 1 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Project created", content: { "application/json": { schema: { $ref: "#/components/schemas/Project" } } } },
          400: { description: "Validation error" },
          409: { description: "Project key already exists" },
        },
      },
    },
    "/projects/{key}": {
      get: {
        tags: ["Projects"],
        summary: "Get project details",
        description: "Returns details, stats, and member info for a specific project key.",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" }, example: "CORE" },
        ],
        responses: {
          200: { description: "Project details", content: { "application/json": { schema: { $ref: "#/components/schemas/Project" } } } },
          404: { description: "Project not found" },
        },
      },
      patch: {
        tags: ["Projects"],
        summary: "Update project",
        description: "Updates project name, description, color, or lead.",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" }, example: "CORE" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name:        { type: "string", example: "Core Platform V2" },
                  description: { type: "string", example: "Updated description" },
                  color:       { type: "string", example: "#6366f1" },
                  lead_id:     { type: "integer", example: 1 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Project updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Project" } } } },
          404: { description: "Project not found" },
        },
      },
      delete: {
        tags: ["Projects"],
        summary: "Delete project",
        description: "Deletes a project and all associated issues and comments.",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" }, example: "CORE" },
        ],
        responses: {
          200: { description: "Project deleted", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" } } } } } },
          404: { description: "Project not found" },
        },
      },
    },

    // ── Issues ──────────────────────────────────────────────────────────
    "/projects/{key}/issues": {
      get: {
        tags: ["Issues"],
        summary: "List project issues",
        description: "Returns issues in a project. Supports filtering by search query, status, priority, type, and assignee.",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" }, example: "CORE" },
          { name: "search", in: "query", schema: { type: "string" }, description: "Text filter on title and description" },
          { name: "status", in: "query", schema: { type: "string", enum: ["backlog", "todo", "in_progress", "in_review", "done", "canceled"] } },
          { name: "priority", in: "query", schema: { type: "string", enum: ["urgent", "high", "medium", "low", "none"] } },
          { name: "type", in: "query", schema: { type: "string", enum: ["task", "bug", "feature", "improvement"] } },
          { name: "assigneeId", in: "query", schema: { type: "string" }, description: "User ID number or 'unassigned'" },
        ],
        responses: {
          200: {
            description: "List of issues and project metadata",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    project: { type: "object", properties: { id: { type: "integer" }, key: { type: "string" }, name: { type: "string" } } },
                    issues:  { type: "array", items: { $ref: "#/components/schemas/Issue" } },
                  },
                },
              },
            },
          },
          404: { description: "Project not found" },
        },
      },
      post: {
        tags: ["Issues"],
        summary: "Create an issue",
        description: "Creates an issue in the project with an auto-incrementing key (e.g. CORE-4).",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" }, example: "CORE" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title:       { type: "string", example: "Optimize database queries" },
                  description: { type: "string", example: "Add indexes to audit_logs and issues" },
                  status:      { type: "string", enum: ["backlog", "todo", "in_progress", "in_review", "done", "canceled"], default: "todo" },
                  priority:    { type: "string", enum: ["urgent", "high", "medium", "low", "none"], default: "medium" },
                  type:        { type: "string", enum: ["task", "bug", "feature", "improvement"], default: "task" },
                  assignee_id: { type: "integer", example: 1 },
                  estimate:    { type: "integer", example: 3 },
                  due_date:    { type: "string", format: "date-time" },
                  label_ids:   { type: "array", items: { type: "integer" } },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Issue created", content: { "application/json": { schema: { $ref: "#/components/schemas/Issue" } } } },
          400: { description: "Validation error" },
          404: { description: "Project not found" },
        },
      },
    },
    "/issues/{id}": {
      get: {
        tags: ["Issues"],
        summary: "Get issue details",
        description: "Retrieves complete issue metadata including comments and author details.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 },
        ],
        responses: {
          200: { description: "Issue details", content: { "application/json": { schema: { $ref: "#/components/schemas/Issue" } } } },
          404: { description: "Issue not found" },
        },
      },
      patch: {
        tags: ["Issues"],
        summary: "Update issue / Move status",
        description: "Updates issue fields or transitions workflow status (e.g. moving from 'todo' to 'in_progress' or 'done').",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title:       { type: "string", example: "Updated issue title" },
                  description: { type: "string", example: "Updated description text" },
                  status:      { type: "string", enum: ["backlog", "todo", "in_progress", "in_review", "done", "canceled"], example: "done" },
                  priority:    { type: "string", enum: ["urgent", "high", "medium", "low", "none"], example: "urgent" },
                  type:        { type: "string", enum: ["task", "bug", "feature", "improvement"], example: "bug" },
                  assignee_id: { type: "integer", nullable: true, example: 1 },
                  estimate:    { type: "integer", nullable: true, example: 5 },
                  due_date:    { type: "string", format: "date-time", nullable: true },
                  label_ids:   { type: "array", items: { type: "integer" } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Issue updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Issue" } } } },
          404: { description: "Issue not found" },
        },
      },
      delete: {
        tags: ["Issues"],
        summary: "Delete issue",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 },
        ],
        responses: {
          200: { description: "Issue deleted", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" } } } } } },
          404: { description: "Issue not found" },
        },
      },
    },

    // ── Comments ────────────────────────────────────────────────────────
    "/issues/{id}/comments": {
      get: {
        tags: ["Comments"],
        summary: "List issue comments",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 },
        ],
        responses: {
          200: { description: "Array of comments", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/IssueComment" } } } } },
        },
      },
      post: {
        tags: ["Comments"],
        summary: "Add a comment",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content: { type: "string", example: "Fixed in commit abc1234." },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Comment added", content: { "application/json": { schema: { $ref: "#/components/schemas/IssueComment" } } } },
          400: { description: "Validation error" },
        },
      },
    },

    // ── Labels ──────────────────────────────────────────────────────────
    "/labels": {
      get: {
        tags: ["Labels"],
        summary: "List labels",
        parameters: [
          { name: "projectId", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          200: { description: "Array of labels", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Label" } } } } },
        },
      },
      post: {
        tags: ["Labels"],
        summary: "Create label",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name:       { type: "string", example: "backend" },
                  color:      { type: "string", example: "#6366f1" },
                  project_id: { type: "integer", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Label created", content: { "application/json": { schema: { $ref: "#/components/schemas/Label" } } } },
        },
      },
    },

    // ── API Keys ────────────────────────────────────────────────────────
    "/api-keys": {
      get: {
        tags: ["API Keys"],
        summary: "List API keys",
        description: "Returns all API keys. Admin only.",
        responses: {
          200: { description: "Array of API keys", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/ApiKey" } } } } },
          403: { description: "Admin role required" },
        },
      },
      post: {
        tags: ["API Keys"],
        summary: "Generate API key",
        description: "Generates a new API key (`bp_...`) for 3rd party integrations. Returns plaintext key once. Admin only.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "contact"],
                properties: {
                  name:      { type: "string", example: "Jira Sync Bot" },
                  contact:   { type: "string", example: "integrations@company.com" },
                  expiresAt: { type: "string", format: "date-time", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "API key created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok:     { type: "boolean", example: true },
                    id:     { type: "integer", example: 1 },
                    key:    { type: "string", example: "bp_abcdef0123456789abcdef0123456789" },
                    prefix: { type: "string", example: "bp_abcdef01" },
                  },
                },
              },
            },
          },
          403: { description: "Admin role required" },
        },
      },
    },
    "/api-keys/{id}": {
      patch: {
        tags: ["API Keys"],
        summary: "Toggle API key active state",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["active"],
                properties: { active: { type: "boolean" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Status updated" },
          403: { description: "Admin role required" },
        },
      },
      delete: {
        tags: ["API Keys"],
        summary: "Revoke and delete API key",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          200: { description: "API key deleted" },
          403: { description: "Admin role required" },
        },
      },
    },

    // ── Dashboard ───────────────────────────────────────────────────────
    "/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Get workspace overview statistics",
        description: "Returns statistics on projects, open tasks, assigned issues, and active roadmaps.",
        responses: {
          200: {
            description: "Dashboard statistics",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalUsers:       { type: "integer" },
                    totalProjects:    { type: "integer" },
                    totalIssues:      { type: "integer" },
                    inProgressIssues: { type: "integer" },
                    doneIssues:       { type: "integer" },
                    activeProjects:   { type: "array", items: { type: "object" } },
                    myRecentIssues:   { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Users & RBAC ────────────────────────────────────────────────────
    "/users": {
      get: {
        tags: ["Users"],
        summary: "List all users",
        description: "Admin only.",
        responses: {
          200: { description: "User list", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/User" } } } } },
          403: { description: "Admin role required" },
        },
      },
    },
    "/users/{id}": {
      patch: {
        tags: ["Users"],
        summary: "Update user role or approval status",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["pending", "approved", "rejected"] },
                  role:   { type: "string", enum: ["viewer", "editor", "admin"] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "User updated" },
          403: { description: "Admin role required" },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Delete user",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          200: { description: "User deleted" },
          403: { description: "Admin role required" },
        },
      },
    },
    "/rbac": {
      get: {
        tags: ["RBAC"],
        summary: "Get role permissions matrix",
        responses: {
          200: { description: "Permissions map" },
          403: { description: "Admin role required" },
        },
      },
      put: {
        tags: ["RBAC"],
        summary: "Update role permissions matrix",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Permissions updated" },
          403: { description: "Admin role required" },
        },
      },
    },
    "/rbac/me": {
      get: {
        tags: ["RBAC"],
        summary: "Get current user allowed nav keys",
        responses: {
          200: { description: "List of nav keys" },
        },
      },
    },

    // ── Feature Flags ────────────────────────────────────────────────────
    "/feature-flags": {
      get: {
        tags: ["Feature Flags"],
        summary: "List all feature flags",
        responses: {
          200: { description: "Map of feature flags" },
        },
      },
    },
    "/feature-flags/{key}": {
      patch: {
        tags: ["Feature Flags"],
        summary: "Toggle feature flag",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["enabled"],
                properties: { enabled: { type: "boolean" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Flag updated" },
          403: { description: "Admin role required" },
        },
      },
    },

    // ── Audit Log & Changelog ────────────────────────────────────────────
    "/audit": {
      get: {
        tags: ["Audit"],
        summary: "List audit logs",
        parameters: [
          { name: "page",   in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit",  in: "query", schema: { type: "integer", default: 25 } },
          { name: "action", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Paginated audit logs" },
          403: { description: "Admin role required" },
        },
      },
    },
    "/changelog": {
      get: {
        tags: ["Changelog"],
        summary: "List development changelog",
        responses: {
          200: { description: "Array of changelog entries" },
        },
      },
    },

    // ── Auth & Profile ───────────────────────────────────────────────────
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email:    { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Logged in" },
          401: { description: "Invalid credentials" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out and clear session cookie",
        responses: {
          200: { description: "Logged out" },
        },
      },
    },
    "/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Register new user account",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email:    { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                  name:     { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Account created (pending approval)" },
        },
      },
    },
    "/me/profile": {
      get: {
        tags: ["Me"],
        summary: "Get current user profile",
        responses: {
          200: { description: "Profile data" },
        },
      },
      patch: {
        tags: ["Me"],
        summary: "Update current user profile and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name:            { type: "string" },
                  email:           { type: "string", format: "email" },
                  currentPassword: { type: "string" },
                  newPassword:     { type: "string" },
                  avatar:          { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Profile updated" },
        },
      },
    },
    "/me/theme": {
      patch: {
        tags: ["Me"],
        summary: "Update user theme preference",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["theme"],
                properties: { theme: { type: "string", enum: ["dark", "light"] } },
              },
            },
          },
        },
        responses: {
          200: { description: "Theme updated" },
        },
      },
    },
    "/openapi": {
      get: {
        tags: ["Meta"],
        summary: "OpenAPI 3.0 specification JSON",
        security: [],
        responses: {
          200: { description: "OpenAPI specification JSON" },
        },
      },
    },
  },
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(spec);
}
