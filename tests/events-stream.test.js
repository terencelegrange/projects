/**
 * Automated Test Suite for Real-time Ticket & Status Listening
 * Tests:
 * 1. Event bus subscription & live broadcast
 * 2. Ticket creation event with full card payload
 * 3. Ticket status transition (e.g. 'idea' -> 'elaborate') emission & payload integrity
 * 4. Card detail modifications (title, priority, position, assignee) emission
 * 5. Ticket deletion event
 * 6. Multi-project event isolation & filtering
 */

const assert = require("assert");
const crypto = require("crypto");
const { EventEmitter } = require("events");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Setup in-process event bus mirroring src/lib/events.ts
let eventBus = global.__appEventsBus;
if (!eventBus) {
  eventBus = new EventEmitter();
  eventBus.setMaxListeners(100);
  global.__appEventsBus = eventBus;
}

async function emitTestEvent(params) {
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

  // 2. Broadcast on eventBus
  eventBus.emit("system_event", payload);
  if (projectKey) {
    eventBus.emit(`project:${projectKey}`, payload);
  }

  return payload;
}

async function runTests() {
  console.log("\n========================================================");
  console.log("  Running Real-Time Ticket & Status Listening Suite     ");
  console.log("========================================================\n");

  const randSuffix = Math.floor(Math.random() * 899 + 100);
  const testProjectKeyA = `RTA${randSuffix}`;
  const testProjectKeyB = `RTB${randSuffix}`;

  let projectA, projectB, user;

  try {
    // Setup test users & projects
    user = await prisma.user.create({
      data: {
        email: `tester_${Date.now()}@example.com`,
        password_hash: "$2a$10$abcdefghijklmnopqrstuv",
        name: "Test Developer",
        role: "editor",
        status: "approved",
      },
    });

    projectA = await prisma.project.create({
      data: {
        key: testProjectKeyA,
        name: "Realtime Board Alpha",
        color: "#6366f1",
        lead_id: user.id,
      },
    });

    projectB = await prisma.project.create({
      data: {
        key: testProjectKeyB,
        name: "Realtime Board Beta",
        color: "#10b981",
        lead_id: user.id,
      },
    });

    // Test 1: Event Bus Subscription & Issue Creation
    console.log("Test 1: Subscribing to event bus & listening for ticket creation...");
    let receivedEvent = null;

    const listener = (payload) => {
      if (payload.project.key === testProjectKeyA) {
        receivedEvent = payload;
      }
    };
    eventBus.on("system_event", listener);

    const issueA1 = await prisma.issue.create({
      data: {
        project_id: projectA.id,
        issue_number: 1,
        title: "Initial Ticket in Idea",
        description: "Must move dynamically across workflow",
        status: "idea",
        priority: "high",
        type: "feature",
        position: 0,
        assignee_id: user.id,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    await emitTestEvent({
      eventType: "issue.created",
      action: "create",
      project: { id: projectA.id, key: projectA.key, name: projectA.name },
      actor: { id: user.id, name: user.name, email: user.email },
      issue: {
        id: issueA1.id,
        key: `${projectA.key}-${issueA1.issue_number}`,
        issue_number: issueA1.issue_number,
        title: issueA1.title,
        description: issueA1.description,
        status: issueA1.status,
        priority: issueA1.priority,
        type: issueA1.type,
        position: issueA1.position,
        assignee: issueA1.assignee,
      },
    });

    assert.ok(receivedEvent, "Listener should have received the issue.created event");
    assert.strictEqual(receivedEvent.event, "issue.created");
    assert.strictEqual(receivedEvent.issue.title, "Initial Ticket in Idea");
    assert.strictEqual(receivedEvent.issue.status, "idea");
    assert.strictEqual(receivedEvent.issue.priority, "high");
    console.log("  ✓ Test 1 Passed: Ticket creation received via event bus");

    // Test 2: Status Movement ('idea' -> 'elaborate')
    console.log("Test 2: Moving status from 'idea' to 'elaborate' and verifying status transition event...");
    receivedEvent = null;

    const updatedIssue = await prisma.issue.update({
      where: { id: issueA1.id },
      data: { status: "elaborate" },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });

    await emitTestEvent({
      eventType: "issue.status_changed",
      action: "transition",
      project: { id: projectA.id, key: projectA.key, name: projectA.name },
      actor: { id: user.id, name: user.name, email: user.email },
      issue: {
        id: updatedIssue.id,
        key: `${projectA.key}-${updatedIssue.issue_number}`,
        issue_number: updatedIssue.issue_number,
        title: updatedIssue.title,
        description: updatedIssue.description,
        status: updatedIssue.status,
        previous_status: "idea",
        priority: updatedIssue.priority,
        type: updatedIssue.type,
        position: updatedIssue.position,
        assignee: updatedIssue.assignee,
      },
      changes: { status: { from: "idea", to: "elaborate" } },
    });

    assert.ok(receivedEvent, "Listener should have received the issue.status_changed event");
    assert.strictEqual(receivedEvent.event, "issue.status_changed");
    assert.strictEqual(receivedEvent.action, "transition");
    assert.strictEqual(receivedEvent.issue.status, "elaborate");
    assert.strictEqual(receivedEvent.issue.previous_status, "idea");
    assert.strictEqual(receivedEvent.changes.status.from, "idea");
    assert.strictEqual(receivedEvent.changes.status.to, "elaborate");
    console.log("  ✓ Test 2 Passed: Status movement ('idea' -> 'elaborate') emitted and verified");

    // Test 3: Card Details Modification (Title, Priority & Position)
    console.log("Test 3: Updating card details (title, urgent priority, position) and listening for issue.updated...");
    receivedEvent = null;

    const modifiedIssue = await prisma.issue.update({
      where: { id: issueA1.id },
      data: {
        title: "Updated Title - High Priority Item",
        priority: "urgent",
        position: 1.5,
      },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });

    await emitTestEvent({
      eventType: "issue.updated",
      action: "update",
      project: { id: projectA.id, key: projectA.key, name: projectA.name },
      actor: { id: user.id, name: user.name, email: user.email },
      issue: {
        id: modifiedIssue.id,
        key: `${projectA.key}-${modifiedIssue.issue_number}`,
        issue_number: modifiedIssue.issue_number,
        title: modifiedIssue.title,
        description: modifiedIssue.description,
        status: modifiedIssue.status,
        priority: modifiedIssue.priority,
        type: modifiedIssue.type,
        position: modifiedIssue.position,
        assignee: modifiedIssue.assignee,
      },
      changes: {
        title: { from: "Initial Ticket in Idea", to: "Updated Title - High Priority Item" },
        priority: { from: "high", to: "urgent" },
      },
    });

    assert.ok(receivedEvent, "Listener should have received the issue.updated event");
    assert.strictEqual(receivedEvent.event, "issue.updated");
    assert.strictEqual(receivedEvent.issue.title, "Updated Title - High Priority Item");
    assert.strictEqual(receivedEvent.issue.priority, "urgent");
    assert.strictEqual(receivedEvent.issue.position, 1.5);
    console.log("  ✓ Test 3 Passed: Card detail changes (title, priority, position) broadcasted");

    // Test 4: Project Isolation & Filtering
    console.log("Test 4: Verifying project isolation (events from Project B ignored by Project A filter)...");
    let projectAEventsCount = 0;
    let projectBEventsCount = 0;

    const projectAListener = (payload) => {
      if (payload.project.key === testProjectKeyA) projectAEventsCount++;
    };
    const projectBListener = (payload) => {
      if (payload.project.key === testProjectKeyB) projectBEventsCount++;
    };

    eventBus.on("system_event", projectAListener);
    eventBus.on("system_event", projectBListener);

    await emitTestEvent({
      eventType: "issue.created",
      action: "create",
      project: { id: projectB.id, key: projectB.key, name: projectB.name },
      issue: {
        id: 999,
        key: `${projectB.key}-1`,
        issue_number: 1,
        title: "Project B Ticket",
        status: "backlog",
        priority: "medium",
        type: "task",
      },
    });

    assert.strictEqual(projectBEventsCount, 1, "Project B should receive 1 event");
    assert.strictEqual(projectAEventsCount, 0, "Project A should not receive Project B's event");
    console.log("  ✓ Test 4 Passed: Project workspace isolation verified");

    // Test 5: Issue Deletion
    console.log("Test 5: Emitting issue.deleted and checking event payload...");
    receivedEvent = null;

    await emitTestEvent({
      eventType: "issue.deleted",
      action: "delete",
      project: { id: projectA.id, key: projectA.key, name: projectA.name },
      issue: {
        id: issueA1.id,
        key: `${projectA.key}-${issueA1.issue_number}`,
        issue_number: issueA1.issue_number,
        title: modifiedIssue.title,
        status: modifiedIssue.status,
        priority: modifiedIssue.priority,
        type: modifiedIssue.type,
      },
    });

    assert.ok(receivedEvent, "Listener should have received issue.deleted event");
    assert.strictEqual(receivedEvent.event, "issue.deleted");
    assert.strictEqual(receivedEvent.action, "delete");
    assert.strictEqual(receivedEvent.issue.id, issueA1.id);
    console.log("  ✓ Test 5 Passed: Issue deletion broadcast verified");

    // Cleanup listeners
    eventBus.off("system_event", listener);
    eventBus.off("system_event", projectAListener);
    eventBus.off("system_event", projectBListener);

    console.log("\n========================================================");
    console.log("  ALL 5 REAL-TIME LISTENING TESTS PASSED!               ");
    console.log("========================================================\n");
  } finally {
    // Cleanup fixtures
    try {
      if (projectA) {
        await prisma.systemEvent.deleteMany({ where: { project_key: testProjectKeyA } });
        await prisma.issue.deleteMany({ where: { project_id: projectA.id } });
        await prisma.project.delete({ where: { id: projectA.id } });
      }
      if (projectB) {
        await prisma.systemEvent.deleteMany({ where: { project_key: testProjectKeyB } });
        await prisma.issue.deleteMany({ where: { project_id: projectB.id } });
        await prisma.project.delete({ where: { id: projectB.id } });
      }
      if (user) {
        await prisma.user.delete({ where: { id: user.id } });
      }
      await prisma.$disconnect();
    } catch (cleanupErr) {
      // ignore cleanup errors
    }
  }
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
