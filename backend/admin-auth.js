const { createHash, timingSafeEqual } = require("node:crypto");

function fixedTimeEqual(left, right) {
  const leftHash = createHash("sha256").update(String(left)).digest();
  const rightHash = createHash("sha256").update(String(right)).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function createAdminAuth(jwt, secret) {
  return function requireAdmin(req, res, next) {
    const [scheme, token] = String(req.get("authorization") || "").split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ success: false, error: "Admin login required." });
    }

    try {
      const claims = jwt.verify(token, secret);
      if (claims.role !== "admin" || !claims.email) {
        return res.status(403).json({ success: false, error: "Admin access required." });
      }
      req.admin = { email: claims.email };
      return next();
    } catch {
      return res.status(401).json({ success: false, error: "Admin session expired. Log in again." });
    }
  };
}

function verifyAdminCredentials(email, password, configuredEmail, configuredPassword) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const expectedEmail = String(configuredEmail || "").trim().toLowerCase();
  if (!expectedEmail || !configuredPassword || !normalizedEmail || typeof password !== "string") {
    return false;
  }
  const emailMatches = fixedTimeEqual(normalizedEmail, expectedEmail);
  const passwordMatches = fixedTimeEqual(password, configuredPassword);
  return emailMatches && passwordMatches;
}

module.exports = { createAdminAuth, verifyAdminCredentials };
