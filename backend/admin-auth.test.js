const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { createAdminAuth, verifyAdminCredentials } = require("./admin-auth");

function responseHarness() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("admin credentials are case-insensitive for email and exact for password", () => {
  assert.equal(verifyAdminCredentials(" ADMIN@example.com ", "correct-password", "admin@example.com", "correct-password"), true);
  assert.equal(verifyAdminCredentials("admin@example.com", "wrong-password", "admin@example.com", "correct-password"), false);
  assert.equal(verifyAdminCredentials("admin@example.com", "correct-password", "", "correct-password"), false);
});

test("admin middleware accepts only a valid admin token", () => {
  const secret = "test-jwt-secret";
  const requireAdmin = createAdminAuth(jwt, secret);
  const req = {
    get: () => `Bearer ${jwt.sign({ role: "admin", email: "admin@example.com" }, secret)}`,
  };
  const res = responseHarness();
  let nextCalled = false;

  requireAdmin(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.admin, { email: "admin@example.com" });
});

test("customer tokens cannot access admin routes", () => {
  const secret = "test-jwt-secret";
  const requireAdmin = createAdminAuth(jwt, secret);
  const req = { get: () => `Bearer ${jwt.sign({ user: { id: "customer-1" } }, secret)}` };
  const res = responseHarness();
  let nextCalled = false;

  requireAdmin(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});
