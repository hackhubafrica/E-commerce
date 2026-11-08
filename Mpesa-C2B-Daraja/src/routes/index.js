const express = require("express");
const router = express.Router();

const callbackController = require("../controllers/callback.controller");
const adminController = require("../controllers/admin.controller");

// ─── C2B Callback Routes (called by Safaricom) ───────────────────────────────
// These are the URLs you register with Safaricom

router.post("/payment/validation", callbackController.validation);
router.post("/payment/confirmation", callbackController.confirmation);

// ─── Admin / Dev Routes ───────────────────────────────────────────────────────

// Generate a fresh access token
router.get("/admin/token", adminController.generateToken);

// Register ValidationURL & ConfirmationURL with Safaricom
router.post("/admin/register-urls", adminController.registerURLs);

// Simulate a C2B payment (sandbox only)
router.post("/admin/simulate", adminController.simulatePayment);

// View all saved transactions
router.get("/admin/transactions", adminController.getTransactions);

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;