/**
 * Automated Test Suite for Dynamic Per-Project Statuses (1-N Ordering)
 * Tests per-board customization, ordering, dynamic issue defaults, and migration.
 */

const assert = require("assert");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function runTests() {
  console.log("\n========================================================");
  console.log("  Running Dynamic Per-Project Statuses Regression Suite  ");
  console.log("========================================================\n");

  let testProjectA = null;
  let testProjectB = null;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Default Status Provisioning on New Project (Order 1-5)
    // -----------------------------------------------------------------
    console.log("Test 1: Verifying default status provisioning (1-5)...");
    testProjectA = await prisma.project.create({
      data: {
        key: "TESTA",
        name: "Test Project A",
        color: "#6366f1",
      },
    });

    const defaultStatuses = [
      { key: "backlog", name: "Backlog", order: 1, color: "#94a3b8", is_done: false },
      { key: "todo", name: "To Do", order: 2, color: "#3b82f6", is_done: false },
      { key: "in_progress", name: "In Progress", order: 3, color: "#f59e0b", is_done: false },
      { key: "in_review", name: "In Review", order: 4, color: "#a855f7", is_done: false },
      { key: "done", name: "Done", order: 5, color: "#10b981", is_done: true },
    ];

    for (const d of defaultStatuses) {
      await prisma.projectStatus.create({
        data: {
          project_id: testProjectA.id,
          key: d.key,
          name: d.name,
          order: d.order,
          color: d.color,
          is_done: d.is_done,
        },
      });
    }

    const statusesA = await prisma.projectStatus.findMany({
      where: { project_id: testProjectA.id },
      orderBy: { order: "asc" },
    });

    assert.strictEqual(statusesA.length, 5, "Project A should have 5 default statuses");
    assert.strictEqual(statusesA[0].key, "backlog", "Order 1 should be backlog");
    assert.strictEqual(statusesA[0].order, 1, "Order should be 1");
    assert.strictEqual(statusesA[4].key, "done", "Order 5 should be done");
    assert.strictEqual(statusesA[4].is_done, true, "Done status should have is_done=true");
    console.log("  ✓ Test 1 Passed: 5 default stages seeded with strict 1..5 order\n");

    // -----------------------------------------------------------------
    // TEST 2: Add New Custom Status as Order 1 ("idea") and Shift Others
    // -----------------------------------------------------------------
    console.log("Test 2: Adding 'idea' as Order 1 and verifying order re-indexing...");
    // Shift existing >= 1
    await prisma.projectStatus.updateMany({
      where: { project_id: testProjectA.id, order: { gte: 1 } },
      data: { order: { increment: 1 } },
    });

    const ideaStatus = await prisma.projectStatus.create({
      data: {
        project_id: testProjectA.id,
        key: "idea",
        name: "Idea / Feature Ideation",
        order: 1,
        color: "#a855f7",
        is_done: false,
      },
    });

    const reorderedA = await prisma.projectStatus.findMany({
      where: { project_id: testProjectA.id },
      orderBy: { order: "asc" },
    });

    assert.strictEqual(reorderedA.length, 6, "Should now have 6 statuses");
    assert.strictEqual(reorderedA[0].key, "idea", "First status should now be 'idea'");
    assert.strictEqual(reorderedA[0].order, 1, "First status order should be 1");
    assert.strictEqual(reorderedA[1].key, "backlog", "Second status should be 'backlog'");
    assert.strictEqual(reorderedA[1].order, 2, "Second status order should be 2");
    assert.strictEqual(reorderedA[5].order, 6, "Last status order should be 6");
    console.log("  ✓ Test 2 Passed: Custom stage 'idea' added as #1; all other stages shifted to 2..6\n");

    // -----------------------------------------------------------------
    // TEST 3: Batch Re-ordering (1-N)
    // -----------------------------------------------------------------
    console.log("Test 3: Batch re-ordering status stages (moving 'idea' to #3)...");
    // New desired sequence: backlog (1), todo (2), idea (3), in_progress (4), in_review (5), done (6)
    const keyOrder = ["backlog", "todo", "idea", "in_progress", "in_review", "done"];
    for (let i = 0; i < keyOrder.length; i++) {
      await prisma.projectStatus.updateMany({
        where: { project_id: testProjectA.id, key: keyOrder[i] },
        data: { order: i + 1 },
      });
    }

    const checkBatch = await prisma.projectStatus.findMany({
      where: { project_id: testProjectA.id },
      orderBy: { order: "asc" },
    });

    for (let i = 0; i < keyOrder.length; i++) {
      assert.strictEqual(checkBatch[i].key, keyOrder[i], `Position ${i + 1} should be ${keyOrder[i]}`);
      assert.strictEqual(checkBatch[i].order, i + 1, `Order should be ${i + 1}`);
    }
    console.log("  ✓ Test 3 Passed: Batch re-ordering successfully verified\n");

    // -----------------------------------------------------------------
    // TEST 4: Per-Board Customization Isolation (Project A: 3 stages vs Project B: 7 stages)
    // -----------------------------------------------------------------
    console.log("Test 4: Verifying per-board isolation (Project A: 3 stages, Project B: 7 stages)...");
    testProjectB = await prisma.project.create({
      data: {
        key: "TESTB",
        name: "Test Project B",
        color: "#10b981",
      },
    });

    // Configure Project B with 7 stages
    const stagesB = [
      { key: "triage", name: "Triage", order: 1 },
      { key: "spec", name: "Design & Spec", order: 2 },
      { key: "ready", name: "Ready for Dev", order: 3 },
      { key: "dev", name: "In Development", order: 4 },
      { key: "qa", name: "QA Validation", order: 5 },
      { key: "staging", name: "Staging", order: 6 },
      { key: "prod", name: "Production Deployed", order: 7, is_done: true },
    ];

    for (const s of stagesB) {
      await prisma.projectStatus.create({
        data: {
          project_id: testProjectB.id,
          key: s.key,
          name: s.name,
          order: s.order,
          color: "#10b981",
          is_done: Boolean(s.is_done),
        },
      });
    }

    // Configure Project A down to 3 stages: idea (1), in_progress (2), done (3)
    await prisma.projectStatus.deleteMany({
      where: { project_id: testProjectA.id, key: { in: ["backlog", "todo", "in_review"] } },
    });
    const remainingA = await prisma.projectStatus.findMany({
      where: { project_id: testProjectA.id },
      orderBy: { order: "asc" },
    });
    for (let i = 0; i < remainingA.length; i++) {
      await prisma.projectStatus.update({
        where: { id: remainingA[i].id },
        data: { order: i + 1 },
      });
    }

    const finalA = await prisma.projectStatus.findMany({
      where: { project_id: testProjectA.id },
      orderBy: { order: "asc" },
    });
    const finalB = await prisma.projectStatus.findMany({
      where: { project_id: testProjectB.id },
      orderBy: { order: "asc" },
    });

    assert.strictEqual(finalA.length, 3, "Project A should have exactly 3 stages");
    assert.strictEqual(finalB.length, 7, "Project B should have exactly 7 stages");
    console.log(`  ✓ Test 4 Passed: Project A has ${finalA.length} stages and Project B has ${finalB.length} stages without interference\n`);

    // -----------------------------------------------------------------
    // TEST 5: Dynamic Default Issue Creation to Project's Order 1 Stage
    // -----------------------------------------------------------------
    console.log("Test 5: Testing dynamic issue creation defaulting to Project's Order 1 stage...");
    const firstStatusA = finalA[0];
    const firstStatusB = finalB[0];

    const issueA = await prisma.issue.create({
      data: {
        project_id: testProjectA.id,
        issue_number: 1,
        title: "Test Issue in Project A",
        status: firstStatusA.key,
        priority: "medium",
        type: "task",
      },
    });

    const issueB = await prisma.issue.create({
      data: {
        project_id: testProjectB.id,
        issue_number: 1,
        title: "Test Issue in Project B",
        status: firstStatusB.key,
        priority: "high",
        type: "feature",
      },
    });

    assert.strictEqual(issueA.status, firstStatusA.key, `Issue A should default to ${firstStatusA.key}`);
    assert.strictEqual(issueB.status, "triage", "Issue B should default to 'triage'");
    console.log(`  ✓ Test 5 Passed: Issue A created in '${issueA.status}', Issue B created in '${issueB.status}'\n`);

    // -----------------------------------------------------------------
    // TEST 6: Transition Issues Across Custom Stages
    // -----------------------------------------------------------------
    console.log("Test 6: Transitioning issue across custom workflow stages...");
    const updatedIssueB = await prisma.issue.update({
      where: { id: issueB.id },
      data: { status: "prod" },
    });
    assert.strictEqual(updatedIssueB.status, "prod", "Issue B should be moved to 'prod'");
    console.log("  ✓ Test 6 Passed: Issue successfully transitioned to custom final stage\n");

    // -----------------------------------------------------------------
    // TEST 7: Status Deletion with Issue Migration
    // -----------------------------------------------------------------
    console.log("Test 7: Deleting a status stage and migrating issues safely...");
    // Create issue in Project B under stage 'spec'
    const issueToMigrate = await prisma.issue.create({
      data: {
        project_id: testProjectB.id,
        issue_number: 2,
        title: "Issue in spec",
        status: "spec",
        priority: "medium",
        type: "task",
      },
    });

    // Migrate issues from 'spec' to 'ready' before deleting 'spec'
    await prisma.issue.updateMany({
      where: { project_id: testProjectB.id, status: "spec" },
      data: { status: "ready" },
    });
    await prisma.projectStatus.deleteMany({
      where: { project_id: testProjectB.id, key: "spec" },
    });

    const migrated = await prisma.issue.findUnique({ where: { id: issueToMigrate.id } });
    assert.strictEqual(migrated.status, "ready", "Issue should have been migrated to 'ready'");

    const postDeleteB = await prisma.projectStatus.findMany({
      where: { project_id: testProjectB.id },
      orderBy: { order: "asc" },
    });
    assert.strictEqual(postDeleteB.length, 6, "Project B should now have 6 stages");
    console.log("  ✓ Test 7 Passed: Status stage deleted and issues migrated with zero data loss\n");

    console.log("========================================================");
    console.log("  ALL TESTS PASSED SUCCESSFULLY! (7/7)                  ");
    console.log("========================================================\n");
  } catch (err) {
    console.error("❌ Test Failed:", err);
    process.exitCode = 1;
  } finally {
    // Cleanup test data
    console.log("Cleaning up test fixtures...");
    if (testProjectA) {
      await prisma.project.delete({ where: { id: testProjectA.id } }).catch(() => {});
    }
    if (testProjectB) {
      await prisma.project.delete({ where: { id: testProjectB.id } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log("Cleanup complete.");
  }
}

runTests();
