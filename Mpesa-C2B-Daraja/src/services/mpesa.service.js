const axios = require("axios");
const logger = require("../utils/logger");

/**
 * Cached token object: { token: string, expiresAt: number }
 */
let tokenCache = null;

/**
 * Fetches a fresh OAuth access token from Safaricom.
 * Automatically reuses a cached token if still valid.
 */
async function getAccessToken() {
  const now = Date.now();

  // Return cached token if still valid (with 60s buffer)
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    logger.info("Using cached access token");
    return tokenCache.token;
  }

  const { CONSUMER_KEY, CONSUMER_SECRET, MPESA_BASE_URL } = process.env;

  const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");

  try {
    const response = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    const { access_token, expires_in } = response.data;

    tokenCache = {
      token: access_token,
      expiresAt: now + parseInt(expires_in, 10) * 1000,
    };

    logger.info("New access token fetched successfully", {
      expiresIn: `${expires_in}s`,
    });

    return access_token;
  } catch (error) {
    const msg = error.response?.data || error.message;
    logger.error("Failed to fetch access token", { error: msg });
    throw new Error("Could not obtain M-PESA access token");
  }
}

/**
 * Registers ValidationURL and ConfirmationURL with Safaricom.
 */
async function registerURLs() {
  const { MPESA_BASE_URL, SHORTCODE, CONFIRMATION_URL, VALIDATION_URL } = process.env;

  const token = await getAccessToken();

  const payload = {
    ShortCode: SHORTCODE,
    ResponseType: "Completed", // Auto-accept all payments (skips ValidationURL)
    ConfirmationURL: CONFIRMATION_URL,
    ValidationURL: VALIDATION_URL,
  };

  logger.info("Registering C2B URLs...", payload);

  try {
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/c2b/v1/registerurl`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    logger.info("C2B URLs registered successfully", { result: response.data });
    return response.data;
  } catch (error) {
    const msg = error.response?.data || error.message;
    logger.error("Failed to register C2B URLs", { error: msg });
    throw new Error("Could not register C2B URLs");
  }
}

/**
 * Simulates a C2B payment (sandbox only).
 *
 * @param {Object} options
 * @param {number} options.amount       - Amount in KES
 * @param {string} options.msisdn       - Simulated customer phone (use 254708374149 in sandbox)
 * @param {string} options.billRefNumber - Account reference / invoice number
 */
async function simulatePayment({ amount = 1, msisdn = "254708374149", billRefNumber = "TEST001" } = {}) {
  const { MPESA_BASE_URL, SHORTCODE } = process.env;

  if (process.env.NODE_ENV === "production") {
    throw new Error("simulatePayment is only available in sandbox/development mode");
  }

  const token = await getAccessToken();

  const payload = {
    ShortCode: SHORTCODE,
    CommandID: "CustomerPayBillOnline",
    Amount: String(amount),
    Msisdn: msisdn,
    BillRefNumber: billRefNumber,
  };

  logger.info("Simulating C2B payment...", payload);

  try {
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/c2b/v1/simulate`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    logger.info("Payment simulation triggered", { result: response.data });
    return response.data;
  } catch (error) {
    const msg = error.response?.data || error.message;
    logger.error("Payment simulation failed", { error: msg });
    throw new Error("Could not simulate payment");
  }
}

module.exports = { getAccessToken, registerURLs, simulatePayment };