import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { CHANGELOG } from "@/data/changelog";
import { DEFAULT_ROLE_PERMISSIONS } from "@/data/nav";

let initialized = false;

export async function initDb() {
  if (initialized) return;

  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\`            INT NOT NULL AUTO_INCREMENT,
        \`email\`         VARCHAR(200) NOT NULL,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`name\`          VARCHAR(200) NULL,
        \`role\`          VARCHAR(20) NOT NULL DEFAULT 'user',
        \`status\`        VARCHAR(20) NOT NULL DEFAULT 'pending',
        \`theme\`         VARCHAR(10) NOT NULL DEFAULT 'dark',
        \`created_at\`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`users_email_key\` (\`email\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    const avatarExists = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'
    `;
    if (Number(avatarExists[0].cnt) === 0) {
      await prisma.$executeRaw`
        ALTER TABLE \`users\` ADD COLUMN \`avatar\` SMALLINT NULL DEFAULT NULL
      `;
    }

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\`          INT NOT NULL AUTO_INCREMENT,
        \`user_id\`     INT NULL,
        \`action\`      VARCHAR(50) NOT NULL,
        \`resource\`    VARCHAR(100) NOT NULL,
        \`resource_id\` VARCHAR(100) NULL,
        \`details\`     TEXT NULL,
        \`ip\`          VARCHAR(45) NULL,
        \`created_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`audit_logs_user_id_fk\` (\`user_id\`),
        CONSTRAINT \`audit_logs_user_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`feature_flags\` (
        \`key\`         VARCHAR(50) NOT NULL,
        \`enabled\`     TINYINT(1) NOT NULL DEFAULT 1,
        \`label\`       VARCHAR(100) NOT NULL,
        \`description\` VARCHAR(255) NOT NULL,
        PRIMARY KEY (\`key\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`changelog\` (
        \`id\`          INT NOT NULL AUTO_INCREMENT,
        \`date\`        DATE NOT NULL,
        \`description\` TEXT NOT NULL,
        \`created_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`changelog_unique\` (\`date\`, \`description\`(200))
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Sync changelog entries from static data
    for (const entry of CHANGELOG) {
      await prisma.$executeRaw`
        INSERT IGNORE INTO changelog (\`date\`, description)
        VALUES (${entry.date}, ${entry.description})
      `;
    }

    // Seed default flags
    const defaultFlags = [
      { key: "signup",    label: "Sign Up",   description: "Allow new users to register an account" },
      { key: "dashboard", label: "Dashboard", description: "Show the dashboard page in the navigation" },
      { key: "menu",      label: "Navigation Menu", description: "Show navigation links in the sidebar" },
      { key: "projects",  label: "Projects & Issues", description: "Enable project management and Kanban boards" },
    ];
    for (const f of defaultFlags) {
      await prisma.$executeRaw`
        INSERT IGNORE INTO feature_flags (\`key\`, enabled, label, description)
        VALUES (${f.key}, 1, ${f.label}, ${f.description})
      `;
    }

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`role_permissions\` (
        \`role\`    VARCHAR(20) NOT NULL,
        \`nav_key\` VARCHAR(50) NOT NULL,
        PRIMARY KEY (\`role\`, \`nav_key\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`api_keys\` (
        \`id\`         INT NOT NULL AUTO_INCREMENT,
        \`key_hash\`   VARCHAR(64) NOT NULL,
        \`prefix\`     VARCHAR(12) NOT NULL,
        \`name\`       VARCHAR(200) NOT NULL,
        \`contact\`    VARCHAR(200) NOT NULL,
        \`expires_at\` DATETIME NULL,
        \`created_by\` INT NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`last_used\`  DATETIME NULL,
        \`active\`     TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`api_keys_prefix\` (\`prefix\`),
        KEY \`api_keys_created_by\` (\`created_by\`),
        CONSTRAINT \`api_keys_created_by_fk\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Projects table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`projects\` (
        \`id\`          INT NOT NULL AUTO_INCREMENT,
        \`key\`         VARCHAR(10) NOT NULL,
        \`name\`        VARCHAR(100) NOT NULL,
        \`description\` TEXT NULL,
        \`color\`       VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
        \`icon\`        VARCHAR(50) NOT NULL DEFAULT 'folder',
        \`lead_id\`     INT NULL,
        \`created_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`projects_key_key\` (\`key\`),
        KEY \`projects_lead_id_fk\` (\`lead_id\`),
        CONSTRAINT \`projects_lead_id_fk\` FOREIGN KEY (\`lead_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Issues table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`issues\` (
        \`id\`           INT NOT NULL AUTO_INCREMENT,
        \`project_id\`   INT NOT NULL,
        \`issue_number\` INT NOT NULL,
        \`title\`        VARCHAR(255) NOT NULL,
        \`description\`  TEXT NULL,
        \`status\`       VARCHAR(30) NOT NULL DEFAULT 'todo',
        \`priority\`     VARCHAR(20) NOT NULL DEFAULT 'medium',
        \`type\`         VARCHAR(20) NOT NULL DEFAULT 'task',
        \`assignee_id\`  INT NULL,
        \`reporter_id\`  INT NULL,
        \`due_date\`     DATETIME NULL,
        \`estimate\`     INT NULL,
        \`created_at\`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`issues_project_number_key\` (\`project_id\`, \`issue_number\`),
        KEY \`issues_project_id_fk\` (\`project_id\`),
        KEY \`issues_assignee_id_fk\` (\`assignee_id\`),
        KEY \`issues_reporter_id_fk\` (\`reporter_id\`),
        CONSTRAINT \`issues_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`issues_assignee_id_fk\` FOREIGN KEY (\`assignee_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`issues_reporter_id_fk\` FOREIGN KEY (\`reporter_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Issue comments
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`issue_comments\` (
        \`id\`         INT NOT NULL AUTO_INCREMENT,
        \`issue_id\`   INT NOT NULL,
        \`user_id\`    INT NOT NULL,
        \`content\`    TEXT NOT NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`issue_comments_issue_id_fk\` (\`issue_id\`),
        KEY \`issue_comments_user_id_fk\` (\`user_id\`),
        CONSTRAINT \`issue_comments_issue_id_fk\` FOREIGN KEY (\`issue_id\`) REFERENCES \`issues\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`issue_comments_user_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Labels
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`labels\` (
        \`id\`         INT NOT NULL AUTO_INCREMENT,
        \`name\`       VARCHAR(50) NOT NULL,
        \`color\`      VARCHAR(20) NOT NULL DEFAULT '#64748b',
        \`project_id\` INT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`labels_project_id_fk\` (\`project_id\`),
        CONSTRAINT \`labels_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`issue_labels\` (
        \`issue_id\` INT NOT NULL,
        \`label_id\` INT NOT NULL,
        PRIMARY KEY (\`issue_id\`, \`label_id\`),
        KEY \`issue_labels_label_id_fk\` (\`label_id\`),
        CONSTRAINT \`issue_labels_issue_id_fk\` FOREIGN KEY (\`issue_id\`) REFERENCES \`issues\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`issue_labels_label_id_fk\` FOREIGN KEY (\`label_id\`) REFERENCES \`labels\` (\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Seed default role permissions
    for (const [role, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const nav_key of keys) {
        await prisma.$executeRaw`
          INSERT IGNORE INTO role_permissions (role, nav_key) VALUES (${role}, ${nav_key})
        `;
      }
    }

    // Seed admin from env
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminHash  = process.env.ADMIN_PASSWORD_HASH;
    let adminUserId: number | null = null;
    if (adminEmail && adminHash) {
      const existing = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM users WHERE email = ${adminEmail} LIMIT 1
      `;
      if (existing.length === 0) {
        await prisma.$executeRaw`
          INSERT INTO users (email, password_hash, name, role, status, created_at, updated_at)
          VALUES (${adminEmail}, ${adminHash}, 'Administrator', 'admin', 'approved', NOW(), NOW())
        `;
        const newlyCreated = await prisma.$queryRaw<{ id: number }[]>`
          SELECT id FROM users WHERE email = ${adminEmail} LIMIT 1
        `;
        if (newlyCreated.length > 0) adminUserId = newlyCreated[0].id;
      } else {
        adminUserId = existing[0].id;
      }
    }

    // Seed starter project if none exists
    const projectCount = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*) AS cnt FROM projects
    `;
    if (Number(projectCount[0].cnt) === 0) {
      await prisma.$executeRaw`
        INSERT INTO projects (\`key\`, \`name\`, \`description\`, \`color\`, \`lead_id\`, \`created_at\`, \`updated_at\`)
        VALUES ('CORE', 'Core Platform', 'Main engineering project for product core and backend services', '#6366f1', ${adminUserId}, NOW(), NOW())
      `;
      const proj = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM projects WHERE \`key\` = 'CORE' LIMIT 1
      `;
      if (proj.length > 0) {
        const projectId = proj[0].id;
        // Seed starter issues
        const starterIssues = [
          { num: 1, title: 'Set up development workspace and architecture', desc: 'Initialize Next.js App router, database models, and authentication system.', status: 'done', priority: 'high', type: 'task' },
          { num: 2, title: 'Build Kanban Board with drag and column filtering', desc: 'Interactive board allowing quick movement between status columns.', status: 'in_progress', priority: 'urgent', type: 'feature' },
          { num: 3, title: 'Implement issue detail drawer and comments', desc: 'Allow quick editing of title, priority, status and discussion threads.', status: 'todo', priority: 'high', type: 'feature' },
          { num: 4, title: 'Add real-time search and multi-criteria filters', desc: 'Filter issues by priority, assignee, text query, and type.', status: 'backlog', priority: 'medium', type: 'improvement' },
          { num: 5, title: 'Optimize mobile responsiveness for board and list', desc: 'Ensure Kanban board scrolls cleanly horizontally on smaller viewports.', status: 'backlog', priority: 'low', type: 'improvement' },
        ];
        for (const iss of starterIssues) {
          await prisma.$executeRaw`
            INSERT INTO issues (\`project_id\`, \`issue_number\`, \`title\`, \`description\`, \`status\`, \`priority\`, \`type\`, \`assignee_id\`, \`reporter_id\`, \`created_at\`, \`updated_at\`)
            VALUES (${projectId}, ${iss.num}, ${iss.title}, ${iss.desc}, ${iss.status}, ${iss.priority}, ${iss.type}, ${adminUserId}, ${adminUserId}, NOW(), NOW())
          `;
        }
      }
    }

    initialized = true;
  } catch (e) {
    console.error("[initDb] failed:", e);
    throw e;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
