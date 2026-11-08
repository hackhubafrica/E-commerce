const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { createFirebaseLoginHandler } = require("./firebase-auth");

function harness() {
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

function userStore() {
  const users = [];
  return {
    users,
    async findOne(query) {
      return users.find((user) => Object.entries(query).every(([key, value]) => user[key] === value)) || null;
    },
    async create(user) {
      const saved = { ...user, _id: "customer-1", save: async () => {} };
      users.push(saved);
      return saved;
    },
  };
}

test("verified Firebase phone identity creates an app session", async () => {
  const Users = userStore();
  const handler = createFirebaseLoginHandler({
    firebaseAuth: { verifyIdToken: async () => ({ uid: "firebase-1", phone_number: "+254712345678" }) },
    Users,
    jwt,
    jwtSecret: "test-secret",
  });
  const res = harness();
  await handler({ body: { idToken: "firebase-id-token" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Users.users[0].phone, "+254712345678");
  assert.equal(jwt.verify(res.body.token, "test-secret").user.id, "customer-1");
});

test("Firebase email identities must have a verified email", async () => {
  const Users = userStore();
  const handler = createFirebaseLoginHandler({
    firebaseAuth: { verifyIdToken: async () => ({ uid: "firebase-1", email: "buyer@example.com", email_verified: false }) },
    Users,
    jwt,
    jwtSecret: "test-secret",
  });
  const res = harness();
  await handler({ body: { idToken: "firebase-id-token" } }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(Users.users.length, 0);
});
