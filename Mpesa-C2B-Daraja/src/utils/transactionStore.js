/**
 * Simple in-memory transaction store.
 * In production, replace this with a real database (PostgreSQL, MongoDB, etc.)
 */
const transactions = new Map();

const store = {
  /**
   * Save a confirmed transaction.
   * @param {Object} payload - The C2B confirmation payload from Safaricom
   */
  save(payload) {
    const transID = payload.TransID;
    if (!transID) return null;

    // Prevent duplicate processing
    if (transactions.has(transID)) {
      return { duplicate: true, transaction: transactions.get(transID) };
    }

    const record = {
      transID: payload.TransID,
      transTime: payload.TransTime,
      transAmount: parseFloat(payload.TransAmount),
      businessShortCode: payload.BusinessShortCode,
      billRefNumber: payload.BillRefNumber,
      invoiceNumber: payload.InvoiceNumber || "",
      orgAccountBalance: parseFloat(payload.OrgAccountBalance),
      thirdPartyTransID: payload.ThirdPartyTransID || "",
      msisdn: payload.MSISDN,
      firstName: payload.FirstName || "",
      transactionType: payload.TransactionType,
      savedAt: new Date().toISOString(),
    };

    transactions.set(transID, record);
    return { duplicate: false, transaction: record };
  },

  /**
   * Find a transaction by M-PESA TransID
   */
  findByTransID(transID) {
    return transactions.get(transID) || null;
  },

  /**
   * Get all saved transactions
   */
  getAll() {
    return Array.from(transactions.values()).sort(
      (a, b) => new Date(b.savedAt) - new Date(a.savedAt)
    );
  },

  /**
   * Count of stored transactions
   */
  count() {
    return transactions.size;
  },
};

module.exports = store;