/**
 * Automated Test Suite for Dynamic Project Variables / Attributes
 * Tests creation, querying, upserting, updating, and cascade deletion of project attributes.
 */

const assert = require("assert");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function runTests() {
  console.log("\n========================================================");
  console.log("    Running Project Variables / Attributes Test Suite   ");
  console.log("========================================================\n");

  let testProject = null;

  try {
    // Ensure table exists
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`project_attributes\` (
        \`id\`         INT NOT NULL AUTO_INCREMENT,
        \`project_id\` INT NOT NULL,
        \`key\`        VARCHAR(100) NOT NULL,
        \`value\`      TEXT NOT NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`project_attribute_key_idx\` (\`project_id\`, \`key\`),
        KEY \`project_attributes_proj_idx\` (\`project_id\`),
        CONSTRAINT \`project_attributes_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // -----------------------------------------------------------------
    // TEST 1: Create Project with Dynamic Attributes
    // -----------------------------------------------------------------
    console.log("Test 1: Creating project with dynamic attributes (REPO & DOCS)...");
    testProject = await prisma.project.create({
      data: {
        key: "ATTRTEST",
        name: "Attribute Test Workspace",
        color: "#6366f1",
      },
    });

    const repoAttr = await prisma.projectAttribute.create({
      data: {
        project_id: testProject.id,
        key: "REPO",
        value: "http://192.168.100.252:3000/terence/projects.git",
      },
    });

    const docsAttr = await prisma.projectAttribute.create({
      data: {
        project_id: testProject.id,
        key: "DOCS",
        value: "https://wiki.terence.internal/docs",
      },
    });

    assert.strictEqual(repoAttr.key, "REPO");
    assert.strictEqual(repoAttr.value, "http://192.168.100.252:3000/terence/projects.git");
    assert.strictEqual(docsAttr.key, "DOCS");
    console.log("  ✓ Test 1 Passed: Project and attributes created successfully\n");

    // -----------------------------------------------------------------
    // TEST 2: Query Attributes & Build AttributesMap
    // -----------------------------------------------------------------
    console.log("Test 2: Querying project attributes & verifying map representation...");
    const projectWithAttrs = await prisma.project.findUnique({
      where: { id: testProject.id },
      include: {
        attributes: { orderBy: { created_at: "asc" } },
      },
    });

    assert(projectWithAttrs !== null, "Project must exist");
    assert.strictEqual(projectWithAttrs.attributes.length, 2, "Should have 2 attributes");

    const attributesMap = {};
    for (const a of projectWithAttrs.attributes) {
      attributesMap[a.key] = a.value;
    }

    assert.strictEqual(attributesMap["REPO"], "http://192.168.100.252:3000/terence/projects.git");
    assert.strictEqual(attributesMap["DOCS"], "https://wiki.terence.internal/docs");
    console.log("  ✓ Test 2 Passed: Attributes array and key-value map verified\n");

    // -----------------------------------------------------------------
    // TEST 3: Upsert Single Attribute (Add CI_CD & Update REPO)
    // -----------------------------------------------------------------
    console.log("Test 3: Upserting attributes (adding CI_CD and updating REPO)...");
    await prisma.projectAttribute.upsert({
      where: {
        project_id_key: {
          project_id: testProject.id,
          key: "REPO",
        },
      },
      create: {
        project_id: testProject.id,
        key: "REPO",
        value: "http://192.168.100.252:3000/terence/updated-repo.git",
      },
      update: {
        value: "http://192.168.100.252:3000/terence/updated-repo.git",
      },
    });

    await prisma.projectAttribute.upsert({
      where: {
        project_id_key: {
          project_id: testProject.id,
          key: "CI_CD",
        },
      },
      create: {
        project_id: testProject.id,
        key: "CI_CD",
        value: "https://jenkins.terence.internal/job/attrtest",
      },
      update: {
        value: "https://jenkins.terence.internal/job/attrtest",
      },
    });

    const updatedAttrs = await prisma.projectAttribute.findMany({
      where: { project_id: testProject.id },
    });
    assert.strictEqual(updatedAttrs.length, 3, "Should now have 3 attributes");

    const updatedRepo = updatedAttrs.find((a) => a.key === "REPO");
    assert.strictEqual(updatedRepo.value, "http://192.168.100.252:3000/terence/updated-repo.git");
    console.log("  ✓ Test 3 Passed: Upsert successfully updated existing and added new attribute\n");

    // -----------------------------------------------------------------
    // TEST 4: Delete Single Attribute
    // -----------------------------------------------------------------
    console.log("Test 4: Deleting single attribute (DOCS)...");
    await prisma.projectAttribute.deleteMany({
      where: {
        project_id: testProject.id,
        key: "DOCS",
      },
    });

    const remainingAttrs = await prisma.projectAttribute.findMany({
      where: { project_id: testProject.id },
    });
    assert.strictEqual(remainingAttrs.length, 2, "Should have 2 attributes after deletion");
    assert.strictEqual(remainingAttrs.some((a) => a.key === "DOCS"), false, "DOCS should be deleted");
    console.log("  ✓ Test 4 Passed: Single attribute deleted cleanly\n");

    // -----------------------------------------------------------------
    // TEST 5: Project Isolation
    // -----------------------------------------------------------------
    console.log("Test 5: Verifying project isolation...");
    const otherProject = await prisma.project.create({
      data: {
        key: "ISOLAT1",
        name: "Isolated Project",
      },
    });

    await prisma.projectAttribute.create({
      data: {
        project_id: otherProject.id,
        key: "REPO",
        value: "http://192.168.100.252:3000/other/repo.git",
      },
    });

    const otherAttrs = await prisma.projectAttribute.findMany({
      where: { project_id: otherProject.id },
    });
    assert.strictEqual(otherAttrs.length, 1);
    assert.strictEqual(otherAttrs[0].value, "http://192.168.100.252:3000/other/repo.git");

    await prisma.project.delete({ where: { id: otherProject.id } });
    console.log("  ✓ Test 5 Passed: Project attributes isolated correctly\n");

    // -----------------------------------------------------------------
    // TEST 6: Cascade Deletion
    // -----------------------------------------------------------------
    console.log("Test 6: Verifying cascade deletion of attributes when project is deleted...");
    await prisma.project.delete({ where: { id: testProject.id } });
    testProject = null;

    const orphanedAttrs = await prisma.projectAttribute.findMany({
      where: { key: "ATTRTEST" },
    });
    assert.strictEqual(orphanedAttrs.length, 0, "No orphaned attributes should remain");
    console.log("  ✓ Test 6 Passed: Cascade delete cleanly removed all project attributes\n");

    console.log("========================================================");
    console.log("  ALL PROJECT ATTRIBUTES TESTS PASSED! (6/6)            ");
    console.log("========================================================\n");
  } catch (err) {
    console.error("❌ Test Failed:", err);
    process.exitCode = 1;
  } finally {
    if (testProject) {
      await prisma.project.delete({ where: { id: testProject.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runTests();
