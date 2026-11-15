const axios = require("axios");

const MAX_CART_ITEMS = 30;
const MAX_ITEM_QUANTITY = 20;

const SUPPORTED_STABLECOINS = {
  USDC: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  USDT: { name: "Tether USD", symbol: "USDT", decimals: 6 },
};

function buildStablecoinQuote(products, cart) {
  if (!cart || typeof cart !== "object" || Array.isArray(cart)) {
    throw new Error("Cart must be a product-to-quantity object.");
  }
  const entries = Object.entries(cart);
  if (!entries.length || entries.length > MAX_CART_ITEMS) {
    throw new Error("Cart must contain between 1 and 30 products.");
  }

  const requested = new Map();
  for (const [productId, rawQuantity] of entries) {
    const quantity = Number(rawQuantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      throw new Error("Each product quantity must be a whole number between 1 and 20.");
    }
    requested.set(String(productId), quantity);
  }

  const productById = new Map(products.map((product) => [String(product._id || product.id), product]));
  if ([...requested.keys()].some((id) => !productById.has(id))) {
    throw new Error("One or more products are unavailable. Refresh your cart and try again.");
  }

  let totalCents = 0;
  const items = [];
  for (const [productId, quantity] of requested) {
    const product = productById.get(productId);
    const unitAmount = Math.round(Number(product.new_price) * 100);
    if (!Number.isSafeInteger(unitAmount) || unitAmount < 1) {
      throw new Error("A product has an invalid price and cannot be purchased.");
    }
    totalCents += unitAmount * quantity;
    if (!Number.isSafeInteger(totalCents)) {
      throw new Error("Cart total is too large.");
    }
    items.push({
      productId: String(product._id || product.id),
      name: String(product.name),
      quantity,
      unitAmount,
    });
  }
  return { items, totalCents };
}

function sendError(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

function createStablecoinCheckoutHandlers({ Product, Order, config, checkSupplierAvailability = async () => {} }) {
  const { provider = "coinbase", apiKey, webhookSecret, defaultCurrency = "USDC", defaultNetwork = "ethereum", usdToLocalRate, storefrontUrl, allowedShippingCountries, shippingAmountCents, shippingLabel } = config || {};

  async function createCheckout(req, res) {
    if (!apiKey) return sendError(res, 503, "Stablecoin checkout is not configured yet.");
    const allowedCountries = String(allowedShippingCountries || "").split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
    if (!allowedCountries.length || allowedCountries.some(c => !/^[A-Z]{2}$/.test(c))) return sendError(res, 503, "Shipping countries not configured.");
    if (!/^\d+$/.test(String(shippingAmountCents ?? "")) || !String(shippingLabel || "").trim()) return sendError(res, 503, "Shipping charge not configured.");
    const shippingAmountCentsVal = Number(shippingAmountCents);
    if (!Number.isSafeInteger(shippingAmountCentsVal) || shippingAmountCentsVal < 0) return sendError(res, 503, "Invalid shipping charge.");
    const baseUrl = String(storefrontUrl || "").replace(/\/+$/, "");
    if (!baseUrl || !/^https:\/\//.test(baseUrl)) return sendError(res, 503, "Storefront URL not configured for stablecoin checkout.");
    const { items: cartItems, countryCode } = req.body || {};
    if (!cartItems || typeof cartItems !== "object") return sendError(res, 400, "Cart items are required.");

    try {
      const productIds = Object.keys(cartItems);
      const products = await Product.find({ _id: { $in: productIds } }).lean();
      if (products.length !== productIds.length) return sendError(res, 400, "One or more products are unavailable.");
      const quote = buildStablecoinQuote(products, cartItems);
      if (checkSupplierAvailability) await checkSupplierAvailability(quote.items, countryCode);
      const totalCents = quote.totalCents + shippingAmountCentsVal;
      let usdCents = totalCents;
      if (usdToLocalRate && Number(usdToLocalRate) > 0) usdCents = Math.round((totalCents / 100) * Number(usdToLocalRate)) * 100;
      const stablecoinAmount = usdCents / 100;
      const orderId = `SC-${Date.now()}`;
      let chargeResult;
      if (provider === "coinbase") chargeResult = await createCoinbaseCharge({ apiKey, orderId, amount: stablecoinAmount, currency: defaultCurrency, network: defaultNetwork, baseUrl, items: quote.items, shippingAmountCents: shippingAmountCentsVal, shippingLabel });
      else if (provider === "nowpayments") chargeResult = await createNowPaymentsCharge({ apiKey, orderId, amount: stablecoinAmount, currency: defaultCurrency, network: defaultNetwork, baseUrl, items: quote.items, shippingAmountCents: shippingAmountCentsVal, shippingLabel });
      else return sendError(res, 503, "Unsupported stablecoin payment provider.");
      const order = new Order({
        orderId,
        customerEmail: req.body.customerEmail || "",
        customerName: req.body.customerName || "",
        customerPhone: req.body.customerPhone || "",
        customerAddress: req.body.customerAddress || "",
        paymentMethod: `Stablecoin (${defaultCurrency})`,
        orderTotal: totalCents / 100,
        currency: "USD",
        status: "pending",
        paymentStatus: "pending",
        fulfillmentStatus: "awaiting_payment",
        items: quote.items,
        shippingCountry: countryCode || "",
        shippingAmountCents: shippingAmountCentsVal,
        stablecoin: { provider, currency: defaultCurrency, network: defaultNetwork, amount: stablecoinAmount, chargeId: chargeResult.chargeId || chargeResult.id || "", paymentAddress: chargeResult.paymentAddress || "", paymentUrl: chargeResult.paymentUrl || "", expiresAt: chargeResult.expiresAt || null },
      });
      await order.save();
      return res.json({ success: true, orderId, paymentAddress: chargeResult.paymentAddress, paymentUrl: chargeResult.paymentUrl, amount: stablecoinAmount, currency: defaultCurrency, network: defaultNetwork, expiresAt: chargeResult.expiresAt || null, qrCode: chargeResult.qrCode || null, checkoutUrl: chargeResult.checkoutUrl || chargeResult.paymentUrl || "" });
    } catch (error) {
      console.error("Stablecoin checkout error:", error);
      return sendError(res, 500, error.message || "Unable to create stablecoin payment.");
    }
  }

  async function stablecoinWebhook(req, res) {
    try {
      const signature = req.headers["x-cc-webhook-signature"] || req.headers["x-nowpayments-signature"] || "";
      const payload = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body);
      if (webhookSecret) {
        const isValid = verifyWebhookSignature(provider, payload, signature, webhookSecret);
        if (!isValid) return sendError(res, 401, "Invalid webhook signature.");
      }
      const body = typeof payload === "string" ? JSON.parse(payload) : payload;
      let chargeId, orderReference, paymentStatus, txHash, amount;
      if (provider === "coinbase") {
        chargeId = body.event?.data?.id || body.id;
        orderReference = body.event?.data?.metadata?.order_id || body.metadata?.order_id;
        paymentStatus = body.event?.data?.payment?.status || body.status;
        txHash = body.event?.data?.transaction?.hash || body.transaction_hash;
        amount = body.event?.data?.payment?.value || body.value;
      } else if (provider === "nowpayments") {
        chargeId = body.payment_id || body.id;
        orderReference = body.order_id || body.metadata?.order_id;
        paymentStatus = body.payment_status || body.status;
        txHash = body.transaction_hash || body.tx_hash;
        amount = body.price_amount || body.amount;
      }
      if (!orderReference) {
        console.error("Stablecoin webhook missing order reference:", body);
        return res.status(200).json({ received: true });
      }
      const order = await Order.findOne({ orderId: orderReference });
      if (!order) return sendError(res, 404, "Order not found.");
      const isPaid = ["completed", "confirmed", "paid", "finished"].includes(String(paymentStatus || "").toLowerCase());
      const isFailed = ["failed", "canceled", "cancelled", "expired"].includes(String(paymentStatus || "").toLowerCase());
      if (isPaid && order.paymentStatus !== "paid") {
        await Order.updateOne({ orderId: orderReference, paymentStatus: "pending" }, { $set: { status: "completed", paymentStatus: "paid", fulfillmentStatus: "awaiting_supplier_review", transactionReference: txHash || chargeId, "stablecoin.txHash": txHash, "stablecoin.confirmedAmount": amount, "stablecoin.paymentStatus": "confirmed" } });
        console.log(`Stablecoin payment confirmed for order ${orderReference}`);
      } else if (isFailed && order.paymentStatus !== "failed") {
        await Order.updateOne({ orderId: orderReference, paymentStatus: "pending" }, { $set: { status: "failed", paymentStatus: "failed", fulfillmentStatus: "not_submitted", "stablecoin.paymentStatus": "failed" } });
        console.log(`Stablecoin payment failed for order ${orderReference}`);
      }
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Stablecoin webhook error:", error);
      return sendError(res, 500, "Webhook processing failed.");
    }
  }

  return { createCheckout, stablecoinWebhook };
}

async function createCoinbaseCharge({ apiKey, orderId, amount, currency, network, baseUrl, items, shippingAmountCents, shippingLabel }) {
  const description = items.map(i => `${i.name} x${i.quantity}`).join(", ") + ` + ${shippingLabel}`;
  const response = await axios.post("https://api.commerce.coinbase.com/charges", {
    name: `Order ${orderId}`,
    description,
    pricing_type: "fixed_price",
    local_price: { amount: String(amount / 100), currency: "USD" },
    metadata: { order_id: orderId },
    redirect_url: `${baseUrl}/checkout/success?orderId=${orderId}`,
    cancel_url: `${baseUrl}/checkout/cancel?orderId=${orderId}`,
  }, { headers: { "X-CC-Api-Key": apiKey, "X-CC-Version": "2018-03-22", "Content-Type": "application/json" } });
  const data = response.data.data;
  return { chargeId: data.id, paymentAddress: data.payment_address || data.addresses?.[currency]?.address, paymentUrl: data.hosted_url, checkoutUrl: data.hosted_url, expiresAt: data.expires_at, qrCode: data.payment_address ? `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="%23fff"/><text x="50%" y="50%" font-size="16" text-anchor="middle" fill="%23000">${encodeURIComponent(data.payment_address)}</text></svg>` : null };
}

async function createNowPaymentsCharge({ apiKey, orderId, amount, currency, network, baseUrl, items, shippingAmountCents, shippingLabel }) {
  const response = await axios.post("https://api.nowpayments.io/v1/payment", {
    price_amount: amount / 100, price_currency: "usd", pay_currency: currency.toLowerCase(), order_id: orderId, order_description: items.map(i => `${i.name} x${i.quantity}`).join(", "), success_url: `${baseUrl}/checkout/success?orderId=${orderId}`, fail_url: `${baseUrl}/checkout/cancel?orderId=${orderId}`,
  }, { headers: { "x-api-key": apiKey, "Content-Type": "application/json" } });
  const data = response.data;
  return { chargeId: data.payment_id, paymentAddress: data.pay_address, paymentUrl: data.payment_url, checkoutUrl: data.payment_url, expiresAt: data.expiration_estimated_date, qrCode: null };
}

function verifyWebhookSignature(provider, payload, signature, secret) {
  if (!signature || !secret) return false;
  try {
    const crypto = require("node:crypto");
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    return expected === signature;
  } catch (error) { return false; }
}

module.exports = { createStablecoinCheckoutHandlers, SUPPORTED_STABLECOINS };