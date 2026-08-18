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
          attributes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id:         { type: "integer", example: 1 },
                project_id: { type: "integer", example: 1 },
                key:        { type: "string", example: "REPO" },
                value:      { type: "string", example: "https://github.com/org/repo.git" },
                created_at: { type: "string", format: "date-time" },
              },
            },
          },
          attributesMap: {
            type: "object",
            additionalProperties: { type: "string" },
            example: { REPO: "https://github.com/org/repo.git", DOCS: "https://docs.acme.com" },
          },
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
                  attributes:  {
                    type: "object",
                    additionalProperties: { type: "string" },
                    example: { REPO: "https://github.com/org/mobile-app.git", DOCS: "https://docs.mobile.com" },
                    description: "Dynamic key-value variables and attributes (e.g. REPO, DOCS, CI_CD)",
                  },
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
                  attributes:  {
                    type: "object",
                    additionalProperties: { type: "string" },
                    example: { REPO: "https://github.com/org/new-repo.git" },
                  },
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

    // ── Project Attributes ──────────────────────────────────────────────
    "/projects/{key}/attributes": {
      get: {
        tags: ["Project Attributes"],
        summary: "Get project attributes",
        description: "Returns all dynamic key-value variables (e.g. REPO, DOCS) configured for a project.",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" }, example: "CORE" },
        ],
        responses: {
          200: {
            description: "List of project attributes and key-value dictionary",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    projectKey:    { type: "string", example: "CORE" },
                    projectName:   { type: "string", example: "Core Platform" },
                    attributes:    { type: "array", items: { type: "object" } },
                    attributesMap: { type: "object", additionalProperties: { type: "string" }, example: { REPO: "https://github.com/org/repo.git" } },
                  },
                },
              },
            },
          },
          404: { description: "Project not found" },
        },
      },
      post: {
        tags: ["Project Attributes"],
        summary: "Add or update project attribute",
        description: "Upserts a dynamic variable for a project (e.g. key: 'REPO', value: 'https://...').",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" }, example: "CORE" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["key", "value"],
                properties: {
                  key:   { type: "string", example: "REPO", description: "Attribute name / key (e.g. REPO, DOCS, CI_CD)" },
                  value: { type: "string", example: "https://github.com/org/repo.git", description: "Value or URL" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Attribute created or updated" },
          400: { description: "Invalid attribute key or value" },
          404: { description: "Project not found" },
        },
      },
      delete: {
        tags: ["Project Attributes"],
        summary: "Delete project attribute",
        description: "Deletes a project attribute by key or ID.",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" }, example: "CORE" },
          { name: "key", in: "query", schema: { type: "string" }, example: "REPO", description: "Attribute key to delete" },
          { name: "id", in: "query", schema: { type: "integer" }, description: "Attribute numeric ID to delete" },
        ],
        responses: {
          200: { description: "Attribute deleted", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" } } } } } },
          404: { description: "Project not found" },
        },
      },
    },

    // ── Project Statuses (Workflows) ────────────────────────────────────
    "/projects/{key}/statuses": {
      get: {
        tags: ["Project Statuses"],
        summary: "List project workflow statuses",
        description: "Returns all configured workflow status stages for a project ordered by 1 to N position.",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" }, example: "CORE" },
        ],
        responses: {
          200: {
            description: "List of project statuses",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    statuses: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id:         { type: "integer", example: 1 },
                          project_id: { type: "integer", example: 1 },
                          key:        { type: "string", example: "idea" },
                          name:       { type: "string", example: "Idea" },
                          order:      { type: "integer", example: 1 },
                          color:      { type: "string", example: "#6366f1" },
                          is_done:    { type: "boolean", example: false },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          404: { description: "Project not found" },
        },
      },
      post: {
        tags: ["Project Statuses"],
        summary: "Add a workflow status stage to project",
        description: "Creates a new status stage for the project (e.g. 'idea', 'triage', 'qa', 'deployed').",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" }, example: "CORE" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name:    { type: "string", example: "Feature Ideation" },
                  key:     { type: "string", example: "feature_ideation" },
                  color:   { type: "string", example: "#6366f1" },
                  order:   { type: "integer", example: 1 },
                  is_done: { type: "boolean", example: false },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Status stage created" },
          400: { description: "Validation error" },
        },
      },
      put: {
        tags: ["Project Statuses"],
        summary: "Reorder project workflow stages",
        description: "Batch re-orders all status stages for a project to maintain sequential 1..N order.",
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
                  statusIds: { type: "array", items: { type: "integer" }, example: [4, 1, 2, 3, 5] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Statuses reordered" },
        },
      },
    },

    "/projects/{key}/statuses/{id}": {
      patch: {
        tags: ["Project Statuses"],
        summary: "Update a project status stage",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" }, example: "CORE" },
          { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name:    { type: "string", example: "In QA & Review" },
                  key:     { type: "string", example: "in_qa" },
                  color:   { type: "string", example: "#a855f7" },
                  order:   { type: "integer", example: 3 },
                  is_done: { type: "boolean", example: false },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Status updated" },
          404: { description: "Status not found" },
        },
      },
      delete: {
        tags: ["Project Statuses"],
        summary: "Delete a project status stage",
        description: "Deletes the status stage and migrates any existing issues to the chosen target status.",
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" }, example: "CORE" },
          { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 },
          { name: "migrateToKey", in: "query", schema: { type: "string" }, description: "Target status key for existing issues" },
        ],
        responses: {
          200: { description: "Status deleted and issues migrated" },
          400: { description: "Cannot delete the last remaining status" },
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
                  status:      { type: "string", enum: ["backlog", "todo", "in_progress", "in_review", "done", "canceled"], default: "backlog" },
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

    // ── Issue Types ─────────────────────────────────────────────────────
    "/issue-types": {
      get: {
        tags: ["Issue Types"],
        summary: "List all issue types",
        description: "Returns all configured issue types with custom icons, colors, descriptions, and issue counts.",
        responses: {
          200: {
            description: "List of issue types",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    issueTypes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id:          { type: "integer", example: 1 },
                          key:         { type: "string", example: "task" },
                          name:        { type: "string", example: "Task" },
                          icon:        { type: "string", example: "✓" },
                          color:       { type: "string", example: "#3b82f6" },
                          description: { type: "string", example: "General work item" },
                          is_default:  { type: "boolean", example: true },
                          issuesCount: { type: "integer", example: 12 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Issue Types"],
        summary: "Create a new issue type",
        description: "Creates an issue type category (e.g. 'epic', 'spike', 'incident', 'story').",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name:        { type: "string", example: "Epic" },
                  key:         { type: "string", example: "epic" },
                  icon:        { type: "string", example: "🚀" },
                  color:       { type: "string", example: "#a855f7" },
                  description: { type: "string", example: "Large initiative or multi-feature theme" },
                  is_default:  { type: "boolean", example: false },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Issue type created" },
          400: { description: "Validation error or key already exists" },
        },
      },
    },

    "/issue-types/{id}": {
      patch: {
        tags: ["Issue Types"],
        summary: "Update an issue type",
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
                  name:        { type: "string", example: "Defect" },
                  key:         { type: "string", example: "defect" },
                  icon:        { type: "string", example: "🐛" },
                  color:       { type: "string", example: "#ef4444" },
                  description: { type: "string", example: "Defect or system error" },
                  is_default:  { type: "boolean", example: false },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Issue type updated" },
          404: { description: "Issue type not found" },
        },
      },
      delete: {
        tags: ["Issue Types"],
        summary: "Delete an issue type",
        description: "Deletes an issue type and migrates active issues to a target issue type.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 },
          { name: "migrateToKey", in: "query", schema: { type: "string" }, description: "Target issue type key for migration" },
        ],
        responses: {
          200: { description: "Issue type deleted and issues migrated" },
          400: { description: "Cannot delete the last remaining issue type" },
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

    // ── Workflow Statuses ───────────────────────────────────────────────
    "/statuses": {
      get: {
        tags: ["Workflow Statuses"],
        summary: "List workflow statuses with custom label mappings",
        description: "Returns effective display labels for all standard workflow statuses, falling back to defaults if unconfigured.",
        responses: {
          200: {
            description: "Status definitions and lookup map",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    statuses: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          key:          { type: "string", example: "backlog" },
                          label:        { type: "string", example: "Feature Ideation" },
                          defaultLabel: { type: "string", example: "Backlog" },
                          dot:          { type: "string", example: "bg-gray-400" },
                          bg:           { type: "string", example: "bg-gray-100" },
                          text:         { type: "string", example: "text-gray-700" },
                          description:  { type: "string", example: "Ideas and feature requests" },
                        },
                      },
                    },
                    map: {
                      type: "object",
                      example: {
                        backlog: "Feature Ideation",
                        todo: "To Do",
                        in_progress: "In Progress",
                        in_review: "In Review",
                        done: "Done",
                        canceled: "Canceled",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ["Workflow Statuses"],
        summary: "Update custom status display labels",
        description: "Updates custom display names for workflow statuses (e.g. rename 'backlog' to 'Feature Ideation'). Admin only.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  mappings: {
                    type: "object",
                    example: {
                      backlog: "Feature Ideation",
                      in_progress: "Active Sprint",
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Status mappings updated" },
          403: { description: "Admin role required" },
        },
      },
      delete: {
        tags: ["Workflow Statuses"],
        summary: "Reset status mappings to system defaults",
        responses: {
          200: { description: "Statuses reset to defaults" },
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
      post: {
        tags: ["Users"],
        summary: "Create a new user",
        description: "Admin only. Creates an approved, pending, or rejected user with pre-hashed password.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email:    { type: "string", format: "email", example: "developer@company.com" },
                  password: { type: "string", minLength: 8, example: "SecurePass123!" },
                  name:     { type: "string", nullable: true, example: "Alex Mercer" },
                  role:     { type: "string", enum: ["viewer", "editor", "admin"], default: "viewer" },
                  status:   { type: "string", enum: ["approved", "pending", "rejected"], default: "approved" },
                  avatar:   { type: "integer", nullable: true, example: 12 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "User created successfully", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
          400: { description: "Validation error" },
          409: { description: "Email already taken" },
          403: { description: "Admin role required" },
        },
      },
    },
    "/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Get user by ID",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          200: { description: "User details", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
          404: { description: "User not found" },
          403: { description: "Admin role required" },
        },
      },
      patch: {
        tags: ["Users"],
        summary: "Update user details, role, status, or reset password",
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
                  name:     { type: "string", nullable: true },
                  email:    { type: "string", format: "email" },
                  role:     { type: "string", enum: ["viewer", "editor", "admin"] },
                  status:   { type: "string", enum: ["pending", "approved", "rejected"] },
                  password: { type: "string", minLength: 8 },
                  avatar:   { type: "integer", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "User updated successfully" },
          400: { description: "Validation error" },
          409: { description: "Email already taken" },
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
    "/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "List notification digests",
        description: "Returns the current user's recent notification digests (unread first) plus an unread-issue count for the bell badge. Digests group issues that moved into the same notify_on_enter status within a 5-minute window into one entry, rather than one row per move.",
        responses: {
          200: {
            description: "Notification digests",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    notifications: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id:         { type: "integer", example: 1 },
                          project:    { type: "object", properties: { key: { type: "string", example: "CORE" }, name: { type: "string" }, color: { type: "string" } } },
                          statusKey:  { type: "string", example: "in_review" },
                          statusName: { type: "string", example: "In Review" },
                          issueKeys:  { type: "array", items: { type: "string" }, example: ["CORE-2", "CORE-5"] },
                          count:      { type: "integer", example: 2 },
                          read:       { type: "boolean" },
                          createdAt:  { type: "string", format: "date-time" },
                          updatedAt:  { type: "string", format: "date-time" },
                        },
                      },
                    },
                    unreadCount: { type: "integer", example: 2 },
                  },
                },
              },
            },
          },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/notifications/{id}": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark a notification digest read/unread",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { type: "object", properties: { read: { type: "boolean", default: true } } },
            },
          },
        },
        responses: {
          200: { description: "Updated" },
          401: { description: "Not authenticated" },
          404: { description: "Notification not found" },
        },
      },
    },
    "/notifications/read-all": {
      post: {
        tags: ["Notifications"],
        summary: "Mark all notifications read",
        description: "Marks every unread notification digest belonging to the current user as read.",
        responses: {
          200: {
            description: "Marked read",
            content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, updated: { type: "integer" } } } } },
          },
          401: { description: "Not authenticated" },
        },
      },
    },
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
    "/events": {
      get: {
        tags: ["Events & Webhooks"],
        summary: "Query system events stream",
        description: "Retrieves chronological event log for polling workers and external apps. Filter by project, event type, action, or since timestamp.",
        parameters: [
          { name: "projectKey", in: "query", schema: { type: "string" }, description: "Filter by project key (e.g. CORE)" },
          { name: "eventType", in: "query", schema: { type: "string" }, description: "Filter by event type (e.g. issue.status_changed, issue.created, comment.created)" },
          { name: "action", in: "query", schema: { type: "string", enum: ["create", "update", "delete", "transition"] } },
          { name: "since", in: "query", schema: { type: "string" }, description: "ISO timestamp or millisecond timestamp" },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          200: {
            description: "List of system events with full payloads and API hypermedia links",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    total:  { type: "integer", example: 42 },
                    limit:  { type: "integer", example: 50 },
                    offset: { type: "integer", example: 0 },
                    events: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/events/{id}": {
      get: {
        tags: ["Events & Webhooks"],
        summary: "Get specific event details",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, example: "evt_1723980000_a1b2c3" },
        ],
        responses: {
          200: { description: "Event details with payload" },
          404: { description: "Event not found" },
        },
      },
    },
    "/webhooks": {
      get: {
        tags: ["Events & Webhooks"],
        summary: "List registered webhooks",
        responses: {
          200: { description: "List of webhooks with delivery stats" },
        },
      },
      post: {
        tags: ["Events & Webhooks"],
        summary: "Register a webhook endpoint",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "url"],
                properties: {
                  name:       { type: "string", example: "Slack Bot Webhook" },
                  url:        { type: "string", example: "https://api.slack.com/events" },
                  secret:     { type: "string", example: "whsec_custom_secret_123" },
                  events:     { type: "array", items: { type: "string" }, example: ["issue.status_changed", "issue.created"] },
                  project_id: { type: "integer", nullable: true, example: 1 },
                  active:     { type: "boolean", default: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Webhook registered successfully" },
          400: { description: "Invalid URL or parameters" },
        },
      },
    },
    "/webhooks/{id}": {
      get: {
        tags: ["Events & Webhooks"],
        summary: "Get webhook details",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Webhook details" },
          404: { description: "Webhook not found" },
        },
      },
      patch: {
        tags: ["Events & Webhooks"],
        summary: "Update webhook settings or toggle active",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name:       { type: "string" },
                  url:        { type: "string" },
                  secret:     { type: "string" },
                  events:     { type: "array", items: { type: "string" } },
                  project_id: { type: "integer", nullable: true },
                  active:     { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Webhook updated" },
          404: { description: "Webhook not found" },
        },
      },
      delete: {
        tags: ["Events & Webhooks"],
        summary: "Delete webhook",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Webhook deleted" },
        },
      },
    },
    "/webhooks/{id}/test": {
      post: {
        tags: ["Events & Webhooks"],
        summary: "Send test ping to webhook",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Ping attempt completed with delivery status" },
        },
      },
    },
    "/webhooks/{id}/deliveries": {
      get: {
        tags: ["Events & Webhooks"],
        summary: "Get recent webhook delivery logs",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "List of delivery attempts and HTTP status codes" },
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
