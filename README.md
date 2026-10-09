# Projects

A modern, full-featured project management platform and issue tracker built with Next.js 15, React, Tailwind CSS, Prisma, and MySQL.

## Features

- 🚀 **First-run Setup Wizard**: Interactive web-based configuration for database connection, automatic schema migrations, and initial administrator account creation.
- 📋 **Project Workspaces & Kanban**: Interactive Kanban board with drag-and-drop workflow statuses, customizable issue types, and issue detail markup viewing.
- 👥 **User Management & RBAC**: Comprehensive user administration, approval workflows, custom role-based access permissions, and session auditing.
- 🔔 **Webhooks & Real-time Events**: HTTP webhook dispatch with HMAC-SHA256 signatures, delivery logging, and review notifications.
- 📊 **Observability Hub**: Analytics dashboards and structured log collector.

## Getting Started

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open `http://localhost:3333` in your browser. If it is your first time running the application, you will automatically be guided through the `/setup` configuration wizard.

## Build & Production

```bash
npm run build
npm start
```
