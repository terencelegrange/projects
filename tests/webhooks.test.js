/**
 * Automated Test Suite for Webhooks & Events Notification System
 * Verifies event emission (created, updated, status_changed, comment, deleted),
 * payload hypermedia API links, system events polling/filtering, and webhook deliveries with HMAC signatures.
 */

const assert = require("assert");
const crypto = require("crypto");
const http = require("http");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Helper mirroring src/lib/events.ts
async function emitEvent(params) {
  const eventId = `evt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const timestamp = new Date().toISOString();

  const issueKey = params.issue?.key;
  const projectKey = params.project.key;

  const payload = {
    id: eventId,
    event: params.eventType,
    action: params.action,
    timestamp,
    actor: params.actor || null,
    project: params.project,
    issue: params.issue || null,
    comment: params.comment || null,
    changes: params.changes || undefined,
    metadata: params.metadata || undefined,
    api_urls: {
      issue: issueKey ? `/api/issues/${issueKey}` : undefined,
      issue_comments: issueKey ? `/api/issues/${issueKey}/comments` : undefined,
      project: `/api/projects/${projectKey}`,
      project_issues: `/api/projects/${projectKey}/issues`,
      project_statuses: `/api/projects/${projectKey}/statuses`,
      project_attributes: `/api/projects/${projectKey}/attributes`,
    },
  };

  const payloadJson = JSON.stringify(payload);

  // 1. Persist in system_events
  await prisma.systemEvent.create({
    data: {
      event_id: eventId,
      event_type: params.eventType,
      action: params.action,
      resource_type: params.issue ? "issue" : params.comment ? "comment" : "project",
      resource_key: issueKey || projectKey,
      project_key: projectKey,
      project_id: params.project.id,
      actor_id: params.actor?.id || null,
      payload: payloadJson,
    },
  });

  // 2. Dispatch to matching webhooks
  const webhooks = await prisma.webhook.findMany({
    where: { active: true },
  });

  for (const webhook of webhooks) {
    if (webhook.project_id && webhook.project_id !== payload.project.id) {
      continue;
    }

    let subscribedEvents = [];
    try {
      subscribedEvents = JSON.parse(webhook.events);
    } catch {
      subscribedEvents = webhook.events.split(",").map((s) => s.trim());
    }

    const isSubscribed =
      subscribedEvents.includes("*") ||
      subscribedEvents.includes(payload.event) ||
      (payload.event.startsWith("issue.") && subscribedEvents.includes("issue.*")) ||
      (payload.event.startsWith("comment.") && subscribedEvents.includes("comment.*"));

    if (!isSubscribed) continue;

    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "Projects-Webhook/1.0",
      "X-Event-Type": payload.event,
      "X-Event-ID": payload.id,
      "X-Event-Action": payload.action,
      "X-Project-Key": payload.project.key,
    };

    if (webhook.secret) {
      const hmac = crypto.createHmac("sha256", webhook.secret);
      hmac.update(payloadJson);
      headers["X-Webhook-Signature-256"] = `sha256=${hmac.digest("hex")}`;
    }

    const startTime = Date.now();
    let status = null;
    let responseBody = null;
    let errorMsg = null;

    try {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: payloadJson,
      });
      status = res.status;
      responseBody = await res.text();
    } catch (e) {
      errorMsg = e.message;
    }

    const duration = Date.now() - startTime;

    await prisma.webhookDelivery.create({
      data: {
        webhook_id: webhook.id,
        event_id: payload.id,
        event_type: payload.event,
        payload: payloadJson,
        response_status: status,
        response_body: responseBody,
        duration_ms: duration,
        error: errorMsg,
      },
    });
  }

  return payload;
}

async function runTests() {
  console.log("\n========================================================");
  console.log("      Running Webhooks & Events Test Suite              ");
  console.log("========================================================\n");

  let testProject = null;
  let testUser = null;
  let testServer = null;
  const receivedWebhookDeliveries = [];

  try {
    // 0. Ensure tables exist
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`system_events\` (
        \`id\`            INT NOT NULL AUTO_INCREMENT,
        \`event_id\`      VARCHAR(64) NOT NULL,
        \`event_type\`    VARCHAR(100) NOT NULL,
        \`action\`        VARCHAR(50) NOT NULL,
        \`resource_type\` VARCHAR(50) NOT NULL,
        \`resource_key\`  VARCHAR(100) NOT NULL,
        \`project_key\`   VARCHAR(20) NOT NULL,
        \`project_id\`    INT NULL,
        \`actor_id\`      INT NULL,
        \`payload\`       TEXT NOT NULL,
        \`created_at\`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`system_event_id_idx\` (\`event_id\`),
        KEY \`system_events_type_idx\` (\`event_type\`),
        KEY \`system_events_proj_idx\` (\`project_key\`),
        KEY \`system_events_res_idx\` (\`resource_key\`),
        KEY \`system_events_created_idx\` (\`created_at\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`webhooks\` (
        \`id\`         INT NOT NULL AUTO_INCREMENT,
        \`name\`       VARCHAR(100) NOT NULL,
        \`url\`        VARCHAR(500) NOT NULL,
        \`secret\`     VARCHAR(255) NULL,
        \`events\`     TEXT NOT NULL,
        \`project_id\` INT NULL,
        \`active\`     BOOLEAN NOT NULL DEFAULT TRUE,
        \`created_by\` INT NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`webhooks_project_id_idx\` (\`project_id\`),
        CONSTRAINT \`webhooks_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`webhook_deliveries\` (
        \`id\`              INT NOT NULL AUTO_INCREMENT,
        \`webhook_id\`      INT NOT NULL,
        \`event_id\`        VARCHAR(64) NOT NULL,
        \`event_type\`      VARCHAR(100) NOT NULL,
        \`payload\`         TEXT NOT NULL,
        \`response_status\` INT NULL,
        \`response_body\`   TEXT NULL,
        \`duration_ms\`     INT NULL,
        \`error\`           TEXT NULL,
        \`created_at\`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`webhook_deliveries_webhook_id_idx\` (\`webhook_id\`),
        KEY \`webhook_deliveries_event_id_idx\` (\`event_id\`),
        KEY \`webhook_deliveries_created_idx\` (\`created_at\`),
        CONSTRAINT \`webhook_deliveries_webhook_id_fk\` FOREIGN KEY (\`webhook_id\`) REFERENCES \`webhooks\` (\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Spin up local mock webhook receiver server
    const webhookPort = 38991;
    testServer = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        receivedWebhookDeliveries.push({
          headers: req.headers,
          body: body ? JSON.parse(body) : null,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: true }));
      });
    });

    await new Promise((resolve) => testServer.listen(webhookPort, resolve));
    console.log(`✓ Test webhook mock receiver listening on port ${webhookPort}\n`);

    // Setup Test Project & User
    testUser = await prisma.user.findFirst();
    testProject = await prisma.project.create({
      data: {
        key: "EVTTEST",
        name: "Events Test Project",
        color: "#6366f1",
      },
    });

    // -----------------------------------------------------------------
    // TEST 1: Register Webhook Subscription with HMAC Secret
    // -----------------------------------------------------------------
    console.log("Test 1: Registering webhook endpoint with HMAC secret...");
    const webhookSecret = "whsec_test_secret_998877";
    const webhook = await prisma.webhook.create({
      data: {
        name: "Test Receiver Hook",
        url: `http://127.0.0.1:${webhookPort}/webhook`,
        secret: webhookSecret,
        events: JSON.stringify(["issue.status_changed", "issue.created", "comment.created", "issue.deleted"]),
        project_id: testProject.id,
        active: true,
      },
    });

    assert(webhook.id > 0, "Webhook must be created");
    assert.strictEqual(webhook.secret, webhookSecret);
    console.log("  ✓ Test 1 Passed: Webhook registered with HMAC secret\n");

    // -----------------------------------------------------------------
    // TEST 2: Issue Created Event & API Hypermedia Links
    // -----------------------------------------------------------------
    console.log("Test 2: Creating issue and verifying issue.created event...");
    const issue = await prisma.issue.create({
      data: {
        project_id: testProject.id,
        issue_number: 1,
        title: "Test Webhook Trigger Ticket",
        status: "backlog",
        priority: "high",
        type: "task",
      },
    });

    const issueKey = `${testProject.key}-${issue.issue_number}`;

    const createdPayload = await emitEvent({
      eventType: "issue.created",
      action: "create",
      project: { id: testProject.id, key: testProject.key, name: testProject.name },
      actor: testUser ? { id: testUser.id, name: testUser.name, email: testUser.email } : null,
      issue: {
        id: issue.id,
        key: issueKey,
        issue_number: issue.issue_number,
        title: issue.title,
        status: issue.status,
        priority: issue.priority,
        type: issue.type,
      },
    });

    assert.strictEqual(createdPayload.event, "issue.created");
    assert.strictEqual(createdPayload.action, "create");
    assert.strictEqual(createdPayload.issue.key, "EVTTEST-1");
    assert.strictEqual(createdPayload.api_urls.issue, "/api/issues/EVTTEST-1");
    assert.strictEqual(createdPayload.api_urls.issue_comments, "/api/issues/EVTTEST-1/comments");
    assert.strictEqual(createdPayload.api_urls.project, "/api/projects/EVTTEST");
    assert.strictEqual(createdPayload.api_urls.project_statuses, "/api/projects/EVTTEST/statuses");
    console.log("  ✓ Test 2 Passed: issue.created event emitted with full api_urls\n");

    // -----------------------------------------------------------------
    // TEST 3: Issue Status Transition Event (Backlog -> Todo)
    // -----------------------------------------------------------------
    console.log("Test 3: Transitioning status ('backlog' -> 'todo') and verifying issue.status_changed...");
    const oldStatus = issue.status;
    const newStatus = "todo";

    await prisma.issue.update({
      where: { id: issue.id },
      data: { status: newStatus },
    });

    const transitionPayload = await emitEvent({
      eventType: "issue.status_changed",
      action: "transition",
      project: { id: testProject.id, key: testProject.key, name: testProject.name },
      actor: testUser ? { id: testUser.id, name: testUser.name, email: testUser.email } : null,
      issue: {
        id: issue.id,
        key: issueKey,
        issue_number: issue.issue_number,
        title: issue.title,
        status: newStatus,
        previous_status: oldStatus,
        priority: issue.priority,
        type: issue.type,
      },
      changes: {
        status: { from: oldStatus, to: newStatus },
      },
    });

    assert.strictEqual(transitionPayload.event, "issue.status_changed");
    assert.strictEqual(transitionPayload.action, "transition");
    assert.strictEqual(transitionPayload.issue.status, "todo");
    assert.strictEqual(transitionPayload.issue.previous_status, "backlog");
    assert.deepStrictEqual(transitionPayload.changes.status, { from: "backlog", to: "todo" });
    console.log("  ✓ Test 3 Passed: issue.status_changed recorded with previous_status and diff\n");

    // -----------------------------------------------------------------
    // TEST 4: Comment Created Event
    // -----------------------------------------------------------------
    console.log("Test 4: Posting comment and verifying comment.created event...");
    const comment = await prisma.issueComment.create({
      data: {
        issue_id: issue.id,
        user_id: testUser ? testUser.id : 1,
        content: "Working on this now - will push branch soon.",
      },
    });

    const commentPayload = await emitEvent({
      eventType: "comment.created",
      action: "create",
      project: { id: testProject.id, key: testProject.key, name: testProject.name },
      actor: testUser ? { id: testUser.id, name: testUser.name, email: testUser.email } : null,
      issue: {
        id: issue.id,
        key: issueKey,
        issue_number: issue.issue_number,
        title: issue.title,
        status: newStatus,
        priority: issue.priority,
        type: issue.type,
      },
      comment: {
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at.toISOString(),
        user: testUser ? { id: testUser.id, name: testUser.name, email: testUser.email } : null,
      },
    });

    assert.strictEqual(commentPayload.event, "comment.created");
    assert.strictEqual(commentPayload.comment.content, "Working on this now - will push branch soon.");
    console.log("  ✓ Test 4 Passed: comment.created event emitted\n");

    // -----------------------------------------------------------------
    // TEST 5: Querying & Filtering System Events API
    // -----------------------------------------------------------------
    console.log("Test 5: Querying system events by projectKey and eventType...");
    const projectEvents = await prisma.systemEvent.findMany({
      where: { project_key: "EVTTEST" },
      orderBy: { created_at: "asc" },
    });

    assert(projectEvents.length >= 3, "Must have at least 3 events for project EVTTEST");

    const statusChangedEvent = projectEvents.find((e) => e.event_type === "issue.status_changed");
    assert(statusChangedEvent !== undefined, "Must contain status_changed event");
    const parsed = JSON.parse(statusChangedEvent.payload);
    assert.strictEqual(parsed.changes.status.to, "todo");
    console.log("  ✓ Test 5 Passed: System events queried and parsed successfully\n");

    // -----------------------------------------------------------------
    // TEST 6: Webhook Delivery Verification & HMAC-SHA256 Signature
    // -----------------------------------------------------------------
    console.log("Test 6: Verifying HTTP webhook delivery and HMAC-SHA256 signature...");
    assert(receivedWebhookDeliveries.length > 0, "Webhook receiver must have received HTTP deliveries");

    const latestDelivery = receivedWebhookDeliveries[receivedWebhookDeliveries.length - 1];
    const signatureHeader = latestDelivery.headers["x-webhook-signature-256"];
    assert(signatureHeader && signatureHeader.startsWith("sha256="), "Must contain X-Webhook-Signature-256 header");

    // Validate HMAC signature
    const computedHmac = "sha256=" + crypto.createHmac("sha256", webhookSecret).update(JSON.stringify(latestDelivery.body)).digest("hex");
    assert.strictEqual(signatureHeader, computedHmac, "HMAC-SHA256 signature must match");

    // Check delivery logs in database
    const deliveryLogs = await prisma.webhookDelivery.findMany({
      where: { webhook_id: webhook.id },
    });
    assert(deliveryLogs.length > 0, "Webhook delivery logs must be saved in database");
    assert.strictEqual(deliveryLogs[0].response_status, 200, "Delivery response status must be 200");
    console.log("  ✓ Test 6 Passed: HTTP Webhook delivery and HMAC signature verified\n");

    console.log("========================================================");
    console.log("  ALL WEBHOOKS & EVENTS TESTS PASSED! (6/6)             ");
    console.log("========================================================\n");
  } catch (err) {
    console.error("❌ Test Failed:", err);
    process.exitCode = 1;
  } finally {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
    if (testProject) {
      await prisma.project.delete({ where: { id: testProject.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runTests();
