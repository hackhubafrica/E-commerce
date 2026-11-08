const { promisify } = require("node:util");
const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");

const scryptAsync = promisify(scrypt);
const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `${HASH_PREFIX}$${salt}$${key.toString("hex")}`;
}

async function verifyPassword(password, storedPassword) {
  if (typeof storedPassword !== "string") {
    return { valid: false, needsUpgrade: false };
  }

  const [prefix, salt, storedKey] = storedPassword.split("$");
  if (prefix === HASH_PREFIX && salt && storedKey) {
    const key = await scryptAsync(password, salt, KEY_LENGTH);
    const expected = Buffer.from(storedKey, "hex");
    const valid =
      expected.length === key.length && timingSafeEqual(expected, key);
    return { valid, needsUpgrade: false };
  }

  const provided = Buffer.from(password);
  const legacy = Buffer.from(storedPassword);
  const valid =
    provided.length === legacy.length && timingSafeEqual(provided, legacy);
  return { valid, needsUpgrade: valid };
}

module.exports = { hashPassword, verifyPassword };
