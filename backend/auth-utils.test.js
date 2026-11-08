const test = require("node:test");
const assert = require("node:assert/strict");
const { hashPassword, verifyPassword } = require("./auth-utils");

test("password hashes verify and do not store the original password", async () => {
  const password = "correct horse battery staple";
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal((await verifyPassword(password, hash)).valid, true);
  assert.equal((await verifyPassword("wrong password", hash)).valid, false);
});

test("legacy plaintext passwords can be checked for one-time upgrade", async () => {
  assert.deepEqual(await verifyPassword("legacy-password", "legacy-password"), {
    valid: true,
    needsUpgrade: true,
  });
  assert.equal((await verifyPassword("wrong-password", "legacy-password")).valid, false);
});
