const mpesa = require("../services/mpesa.service");
const transactionStore = require("../utils/transactionStore");
const logger = require("../utils/logger");

/**
 * GET /admin/token
 * Generates and returns a fresh M-PESA access token.
 */
async function generateToken(req, res) {
  try {
    const token = await mpesa.getAccessToken();
    return res.json({ success: true, token });
  } catch (error) {
    logger.error("Token generation error", { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /admin/register-urls
 * Registers ValidationURL and ConfirmationURL with Safaricom.
 */
async function registerURLs(req, res) {
  try {
    const result = await mpesa.registerURLs();
    return res.json({ success: true, result });
  } catch (error) {
    logger.error("URL registration error", { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /admin/simulate
 * Simulates a C2B payment (sandbox only).
 * Body: { amount, msisdn, billRefNumber }
 */
async function simulatePayment(req, res) {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ success: false, error: "Simulation disabled in production" });
  }

  const { amount = 100, msisdn = "254708374149", billRefNumber = "TEST001" } = req.body;

  try {
    const result = await mpesa.simulatePayment({ amount, msisdn, billRefNumber });
    return res.json({ success: true, result });
  } catch (error) {
    logger.error("Simulation error", { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /admin/transactions
 * Returns all saved transactions from the in-memory store.
 */
function getTransactions(req, res) {
  const transactions = transactionStore.getAll();
  return res.json({
    success: true,
    count: transactions.length,
    transactions,
  });
}

module.exports = { generateToken, registerURLs, simulatePayment, getTransactions };