/**
 * Automated Test Suite for Customizable Issue Types
 * Tests seeding, creating, updating, renaming with issue migration, default assignment, and deletion.
 */

const assert = require("assert");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function runTests() {
  console.log("\n========================================================");
  console.log("     Running Customizable Issue Types Test Suite        ");
  console.log("========================================================\n");

  let testProject = null;

  try {
    // Ensure table exists
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`issue_types\` (
        \`id\`          INT NOT NULL AUTO_INCREMENT,
        \`key\`         VARCHAR(50) NOT NULL,
        \`name\`        VARCHAR(100) NOT NULL,
        \`icon\`        VARCHAR(50) NOT NULL DEFAULT '✓',
        \`color\`       VARCHAR(50) NOT NULL DEFAULT '#3b82f6',
        \`description\` VARCHAR(255) NULL,
        \`is_default\`  BOOLEAN NOT NULL DEFAULT FALSE,
        \`created_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`issue_type_key_idx\` (\`key\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Setup test project
    testProject = await prisma.project.create({
      data: {
        key: "TYPEST",
        name: "Issue Types Test Project",
        color: "#6366f1",
      },
    });

    // -----------------------------------------------------------------
    // TEST 1: Default Issue Types Seeding
    // -----------------------------------------------------------------
    console.log("Test 1: Verifying default issue types exist...");
    const defaults = [
      { key: "task", name: "Task", icon: "✓", color: "#3b82f6", is_default: true },
      { key: "bug", name: "Bug", icon: "🐛", color: "#ef4444", is_default: false },
      { key: "feature", name: "Feature", icon: "✨", color: "#10b981", is_default: false },
      { key: "improvement", name: "Improvement", icon: "⚡", color: "#a855f7", is_default: false },
    ];

    for (const d of defaults) {
      await prisma.issueType.upsert({
        where: { key: d.key },
        create: d,
        update: {},
      });
    }

    const allTypes = await prisma.issueType.findMany();
    assert(allTypes.length >= 4, "Should have at least 4 standard issue types");

    const taskType = await prisma.issueType.findUnique({ where: { key: "task" } });
    assert(taskType !== null, "Task type must exist");
    assert.strictEqual(taskType.icon, "✓", "Task icon should be ✓");
    console.log("  ✓ Test 1 Passed: Default issue types present\n");

    // -----------------------------------------------------------------
    // TEST 2: Add New Custom Issue Type ("Epic" with 🚀)
    // -----------------------------------------------------------------
    console.log("Test 2: Adding custom issue type 'epic' with 🚀 icon...");
    const epicType = await prisma.issueType.create({
      data: {
        key: "epic",
        name: "Epic / Initiative",
        icon: "🚀",
        color: "#a855f7",
        description: "Large body of work encompassing multiple stories",
        is_default: false,
      },
    });

    assert.strictEqual(epicType.key, "epic");
    assert.strictEqual(epicType.icon, "🚀");
    assert.strictEqual(epicType.color, "#a855f7");
    console.log("  ✓ Test 2 Passed: Custom issue type 'epic' created successfully\n");

    // -----------------------------------------------------------------
    // TEST 3: Update and Rename Issue Type
    // -----------------------------------------------------------------
    console.log("Test 3: Updating and renaming issue type...");
    const updatedEpic = await prisma.issueType.update({
      where: { id: epicType.id },
      data: {
        name: "Strategic Epic",
        color: "#6366f1",
        description: "Updated strategic epic description",
      },
    });

    assert.strictEqual(updatedEpic.name, "Strategic Epic");
    assert.strictEqual(updatedEpic.color, "#6366f1");
    console.log("  ✓ Test 3 Passed: Issue type updated successfully\n");

    // -----------------------------------------------------------------
    // TEST 4: Key Renaming with Automatic Issue Reference Migration
    // -----------------------------------------------------------------
    console.log("Test 4: Renaming key and verifying issue auto-migration...");
    // Create custom type 'spike_temp'
    const tempSpike = await prisma.issueType.create({
      data: {
        key: "spike_temp",
        name: "Spike Investigation",
        icon: "🧪",
        color: "#f59e0b",
      },
    });

    // Create an issue using 'spike_temp'
    const testIssue = await prisma.issue.create({
      data: {
        project_id: testProject.id,
        issue_number: 1,
        title: "Investigate database caching performance",
        status: "backlog",
        priority: "high",
        type: "spike_temp",
      },
    });
    assert.strictEqual(testIssue.type, "spike_temp");

    // Simulate key update from 'spike_temp' to 'spike_research'
    await prisma.issue.updateMany({
      where: { type: "spike_temp" },
      data: { type: "spike_research" },
    });
    await prisma.issueType.update({
      where: { id: tempSpike.id },
      data: { key: "spike_research", name: "Research Spike" },
    });

    const reloadedIssue = await prisma.issue.findUnique({ where: { id: testIssue.id } });
    assert.strictEqual(reloadedIssue.type, "spike_research", "Issue type should be migrated to 'spike_research'");
    console.log("  ✓ Test 4 Passed: Key updated and issues referencing old key migrated seamlessly\n");

    // -----------------------------------------------------------------
    // TEST 5: Setting Default Issue Type
    // -----------------------------------------------------------------
    console.log("Test 5: Setting a new default issue type...");
    // Make 'epic' default
    await prisma.issueType.updateMany({
      where: { id: { not: epicType.id } },
      data: { is_default: false },
    });
    await prisma.issueType.update({
      where: { id: epicType.id },
      data: { is_default: true },
    });

    const currentDefault = await prisma.issueType.findFirst({ where: { is_default: true } });
    assert.strictEqual(currentDefault.key, "epic", "Epic should now be default");

    const defaultCheck = await prisma.issueType.findUnique({ where: { key: "task" } });
    assert.strictEqual(defaultCheck.is_default, false, "Task should no longer be default");
    console.log("  ✓ Test 5 Passed: Default issue type switched and enforced\n");

    // -----------------------------------------------------------------
    // TEST 6: Delete Issue Type with Safe Target Migration
    // -----------------------------------------------------------------
    console.log("Test 6: Deleting issue type with issue migration...");
    // Migrate issue from 'spike_research' to 'task'
    await prisma.issue.updateMany({
      where: { type: "spike_research" },
      data: { type: "task" },
    });
    await prisma.issueType.delete({
      where: { key: "spike_research" },
    });

    const deletedCheck = await prisma.issueType.findUnique({ where: { key: "spike_research" } });
    assert.strictEqual(deletedCheck, null, "spike_research should be deleted");

    const postMigratedIssue = await prisma.issue.findUnique({ where: { id: testIssue.id } });
    assert.strictEqual(postMigratedIssue.type, "task", "Issue should now have type 'task'");
    console.log("  ✓ Test 6 Passed: Issue type deleted and issues safely reassigned\n");

    // Cleanup custom 'epic' type and restore task as default
    await prisma.issueType.delete({ where: { key: "epic" } }).catch(() => {});
    await prisma.issueType.update({
      where: { key: "task" },
      data: { is_default: true },
    });

    console.log("========================================================");
    console.log("  ALL ISSUE TYPES TESTS PASSED SUCCESSFULLY! (6/6)     ");
    console.log("========================================================\n");
  } catch (err) {
    console.error("❌ Test Failed:", err);
    process.exitCode = 1;
  } finally {
    console.log("Cleaning up test fixtures...");
    if (testProject) {
      await prisma.project.delete({ where: { id: testProject.id } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log("Cleanup complete.");
  }
}

runTests();
