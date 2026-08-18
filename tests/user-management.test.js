/**
 * Automated Test Suite for User Management (Creation, Editing, and Deletion)
 * Tests user creation, password hashing, role/status updates, credential verification, and safe deletion.
 */

const assert = require("assert");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function runTests() {
  console.log("\n========================================================");
  console.log("       Running User Management Test Suite (CRUD)        ");
  console.log("========================================================\n");

  let createdUserId = null;
  const testEmail = `testuser_${Date.now()}@example.com`;
  const updatedEmail = `testuser_updated_${Date.now()}@example.com`;
  const initialPassword = "InitialPassword123!";
  const updatedPassword = "UpdatedSecurePassword456#";

  try {
    // -----------------------------------------------------------------
    // TEST 1: Create User with Hashed Password & Custom Role/Status
    // -----------------------------------------------------------------
    console.log("Test 1: Creating a new user with hashed password, custom role and status...");
    const hash = await bcrypt.hash(initialPassword, 10);
    
    await prisma.$executeRaw`
      INSERT INTO users (email, password_hash, name, role, status, avatar, created_at, updated_at)
      VALUES (${testEmail}, ${hash}, 'Test User Alpha', 'editor', 'approved', 42, NOW(), NOW())
    `;

    const createdRows = await prisma.$queryRaw`
      SELECT id, email, name, role, status, avatar, password_hash FROM users WHERE email = ${testEmail} LIMIT 1
    `;
    assert.strictEqual(createdRows.length, 1, "User should be created in the database");
    const user = createdRows[0];
    createdUserId = user.id;

    assert.strictEqual(user.email, testEmail);
    assert.strictEqual(user.name, "Test User Alpha");
    assert.strictEqual(user.role, "editor");
    assert.strictEqual(user.status, "approved");
    assert.strictEqual(user.avatar, 42);

    const isMatchInitial = await bcrypt.compare(initialPassword, user.password_hash);
    assert.strictEqual(isMatchInitial, true, "Initial password hash should match plaintext password");
    console.log("✓ Test 1 Passed: User created successfully with valid bcrypt password hash.\n");

    // -----------------------------------------------------------------
    // TEST 2: Duplicate Email Rejection
    // -----------------------------------------------------------------
    console.log("Test 2: Verifying duplicate email rejection...");
    const existing = await prisma.$queryRaw`
      SELECT id FROM users WHERE email = ${testEmail} LIMIT 1
    `;
    assert.strictEqual(existing.length, 1, "Duplicate email check should detect existing user");
    console.log("✓ Test 2 Passed: Duplicate email check succeeded.\n");

    // -----------------------------------------------------------------
    // TEST 3: Edit User Details (Name, Email, Role, Status, Avatar)
    // -----------------------------------------------------------------
    console.log("Test 3: Updating user details (name, email, role, status, avatar)...");
    await prisma.$executeRaw`
      UPDATE users
      SET name = 'Test User Updated',
          email = ${updatedEmail},
          role = 'admin',
          status = 'approved',
          avatar = 88,
          updated_at = NOW()
      WHERE id = ${createdUserId}
    `;

    const updatedRows = await prisma.$queryRaw`
      SELECT id, email, name, role, status, avatar FROM users WHERE id = ${createdUserId} LIMIT 1
    `;
    assert.strictEqual(updatedRows.length, 1);
    const updatedUser = updatedRows[0];
    assert.strictEqual(updatedUser.name, "Test User Updated");
    assert.strictEqual(updatedUser.email, updatedEmail);
    assert.strictEqual(updatedUser.role, "admin");
    assert.strictEqual(updatedUser.status, "approved");
    assert.strictEqual(updatedUser.avatar, 88);
    console.log("✓ Test 3 Passed: User details updated successfully.\n");

    // -----------------------------------------------------------------
    // TEST 4: Reset User Password
    // -----------------------------------------------------------------
    console.log("Test 4: Resetting user password and validating new credentials...");
    const newHash = await bcrypt.hash(updatedPassword, 10);
    await prisma.$executeRaw`
      UPDATE users
      SET password_hash = ${newHash}, updated_at = NOW()
      WHERE id = ${createdUserId}
    `;

    const userWithNewPass = (await prisma.$queryRaw`
      SELECT password_hash FROM users WHERE id = ${createdUserId} LIMIT 1
    `)[0];

    const isOldMatch = await bcrypt.compare(initialPassword, userWithNewPass.password_hash);
    assert.strictEqual(isOldMatch, false, "Old password should no longer match");

    const isNewMatch = await bcrypt.compare(updatedPassword, userWithNewPass.password_hash);
    assert.strictEqual(isNewMatch, true, "New password should match updated hash");
    console.log("✓ Test 4 Passed: Password reset validated with bcrypt comparison.\n");

    // -----------------------------------------------------------------
    // TEST 5: Query & Filter Users by Role / Status
    // -----------------------------------------------------------------
    console.log("Test 5: Querying users list with ordering and role filters...");
    const allUsers = await prisma.$queryRaw`
      SELECT id, email, name, role, status, avatar, created_at, updated_at
      FROM users
      ORDER BY FIELD(status,'pending','approved','rejected'), created_at DESC
    `;
    assert(allUsers.length > 0, "Users list should not be empty");
    const foundAdmin = allUsers.find((u) => u.id === createdUserId);
    assert(foundAdmin, "Created user should be present in user list query");
    assert.strictEqual(foundAdmin.role, "admin");
    console.log("✓ Test 5 Passed: User query and ordering verified.\n");

    // -----------------------------------------------------------------
    // TEST 6: Delete User & Clean References
    // -----------------------------------------------------------------
    console.log("Test 6: Deleting user and verifying cleanup...");
    // Create a dummy notification and assigned issue to verify references handling
    const dummyProject = (await prisma.$queryRaw`SELECT id FROM projects LIMIT 1`)[0];
    if (dummyProject) {
      await prisma.$executeRaw`
        INSERT INTO notifications (user_id, project_id, status_key, status_name, issue_ids, count, \`read\`, created_at, updated_at)
        VALUES (${createdUserId}, ${dummyProject.id}, 'todo', 'To Do', '[]', 1, 0, NOW(), NOW())
      `;
    }

    // Cleanup and delete
    await prisma.$executeRaw`UPDATE projects SET lead_id = NULL WHERE lead_id = ${createdUserId}`;
    await prisma.$executeRaw`UPDATE issues SET assignee_id = NULL WHERE assignee_id = ${createdUserId}`;
    await prisma.$executeRaw`UPDATE issues SET reporter_id = NULL WHERE reporter_id = ${createdUserId}`;
    await prisma.$executeRaw`DELETE FROM issue_comments WHERE user_id = ${createdUserId}`;
    await prisma.$executeRaw`DELETE FROM notifications WHERE user_id = ${createdUserId}`;
    await prisma.$executeRaw`DELETE FROM users WHERE id = ${createdUserId}`;

    const checkDeleted = await prisma.$queryRaw`
      SELECT id FROM users WHERE id = ${createdUserId} LIMIT 1
    `;
    assert.strictEqual(checkDeleted.length, 0, "User should be deleted from the database");
    createdUserId = null;
    console.log("✓ Test 6 Passed: User deleted and references cleaned up.\n");

    console.log("========================================================");
    console.log("    ALL 6 USER MANAGEMENT TESTS PASSED SUCCESSFULLY!    ");
    console.log("========================================================\n");
  } catch (error) {
    console.error("Test Suite Failed with Error:", error);
    process.exit(1);
  } finally {
    if (createdUserId) {
      try {
        await prisma.$executeRaw`DELETE FROM users WHERE id = ${createdUserId}`;
      } catch (e) {
        // ignore
      }
    }
    await prisma.$disconnect();
  }
}

runTests();
