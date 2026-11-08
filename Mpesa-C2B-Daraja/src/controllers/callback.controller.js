const logger = require("../utils/logger");
const transactionStore = require("../utils/transactionStore");

/**
 * POST /payment/validation
 *
 * Called by Safaricom BEFORE a payment is processed.
 * You can accept or reject based on business logic.
 * Only invoked if external validation is enabled on the shortcode.
 */
function validation(req, res) {
  const payload = req.body;

  logger.info("ValidationURL hit", { payload });

  // --- YOUR CUSTOM LOGIC HERE ---
  // Example: check if BillRefNumber exists in your database
  // const customer = await db.findCustomer(payload.BillRefNumber);
  // if (!customer) return res.json({ ResultCode: "C2B00012", ResultDesc: "Invalid account" });

  // Accept the payment
  return res.json({
    ResultCode: "0",
    ResultDesc: "Accepted",
  });
}

/**
 * POST /payment/confirmation
 *
 * Called by Safaricom AFTER a payment is successfully processed.
 * This is where you save the transaction and trigger business logic.
 */
function confirmation(req, res) {
  const payload = req.body;

  logger.info("ConfirmationURL hit — payment received!", { payload });

  // Save transaction (duplicate-safe)
  const result = transactionStore.save(payload);

  if (result?.duplicate) {
    logger.warn("Duplicate transaction ignored", { transID: payload.TransID });
  } else if (result) {
    logger.info("Transaction saved", { transaction: result.transaction });

    // --- YOUR BUSINESS LOGIC HERE ---
    // Examples:
    //   await markOrderAsPaid(payload.BillRefNumber, payload.TransAmount);
    //   await sendReceiptEmail(payload.MSISDN, payload.TransID, payload.TransAmount);
    //   await notifyFulfillmentSystem(result.transaction);
  }

  // IMPORTANT: Always respond with 200 OK and ResultCode "0"
  // Safaricom will retry if it does not receive this in time
  return res.json({
    ResultCode: "0",
    ResultDesc: "Success",
  });
}

module.exports = { validation, confirmation };