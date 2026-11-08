const { randomUUID } = require("node:crypto");

const MAX_CART_ITEMS = 30;
const MAX_ITEM_QUANTITY = 20;

function buildStripeQuote(products, cart) {
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

  const productById = new Map(products.map((product) => [String(product._id), product]));
  if ([...requested.keys()].some((id) => !productById.has(id))) {
    throw new Error("One or more products are unavailable. Refresh your cart and try again.");
  }

  let totalCents = 0;
  const items = [];
  const lineItems = [];
  for (const [productId, quantity] of requested) {
    const product = productById.get(productId);
    if (product.supplier === "cj" && !product.supplierVariantId) {
      throw new Error("A CJ product variant must be configured before this item can be purchased.");
    }
    const unitAmount = Math.round(Number(product.new_price) * 100);
    if (!Number.isSafeInteger(unitAmount) || unitAmount < 1) {
      throw new Error("A product has an invalid price and cannot be purchased.");
    }
    totalCents += unitAmount * quantity;
    if (!Number.isSafeInteger(totalCents)) {
      throw new Error("Cart total is too large.");
    }
    items.push({
      productId,
      name: String(product.name),
      quantity,
      unitAmount,
      supplier: product.supplier || "manual",
      supplierProductId: product.supplierProductId || null,
      supplierVariantId: product.supplierVariantId || null,
      supplierCost: Number(product.supplierCost) || 0,
    });
    lineItems.push({
      quantity,
      price_data: {
        currency: "usd",
        unit_amount: unitAmount,
        product_data: { name: String(product.name).slice(0, 250) },
      },
    });
  }
  return { items, lineItems, totalCents };
}

function sendError(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

function createStripeCheckoutHandlers({
  stripe,
  Product,
  Order,
  config,
  checkSupplierAvailability = async () => {},
}) {
  async function createCheckout(req, res) {
    if (!stripe || !config.stripeSecretKey || !config.webhookSecret) {
      return sendError(res, 503, "Card checkout is not configured yet.");
    }
    const allowedCountries = String(config.allowedShippingCountries || "")
      .split(",")
      .map((country) => country.trim().toUpperCase())
      .filter(Boolean);
    if (!allowedCountries.length || allowedCountries.some((country) => !/^[A-Z]{2}$/.test(country))) {
      return sendError(res, 503, "The store has not configured its allowed shipping countries.");
    }
    if (!/^\d+$/.test(String(config.shippingAmountCents ?? ""))
      || !String(config.shippingLabel || "").trim()) {
      return sendError(res, 503, "The store has not configured a shipping charge.");
    }
    const shippingAmountCents = Number(config.shippingAmountCents);
    if (!Number.isSafeInteger(shippingAmountCents) || shippingAmountCents < 0) {
      return sendError(res, 503, "The store has not configured a valid shipping charge.");
    }

    try {
      const cart = req.body?.items;
      if (!cart || typeof cart !== "object" || Array.isArray(cart)) {
        return sendError(res, 400, "Provide the cart as a product ID to quantity map.");
      }
      const productIds = Object.keys(cart);
      if (!productIds.length || productIds.length > MAX_CART_ITEMS
        || productIds.some((id) => !/^[a-f\d]{24}$/i.test(id))) {
        return sendError(res, 400, "Your cart contains invalid products.");
      }
      const countryCode = String(req.body.countryCode || "").trim().toUpperCase();
      if (!allowedCountries.includes(countryCode)) {
        return sendError(res, 400, "Choose a shipping country served by this store.");
      }

      const products = await Product.find({
        _id: { $in: productIds },
        available: { $ne: false },
      }).lean();
      const quote = buildStripeQuote(products, cart);
      try {
        await checkSupplierAvailability(quote.items, countryCode);
      } catch (error) {
        return sendError(res, 409, error instanceof Error ? error.message : "Supplier availability could not be verified.");
      }
      const totalCents = quote.totalCents + shippingAmountCents;
      if (!Number.isSafeInteger(totalCents)) {
        return sendError(res, 400, "Cart total is too large.");
      }
      const orderId = `ORD-${randomUUID()}`;
      const order = await Order.create({
        orderId,
        paymentMethod: "Credit Card (International)",
        orderTotal: totalCents / 100,
        productSubtotal: quote.totalCents / 100,
        shippingAmount: shippingAmountCents / 100,
        currency: "USD",
        status: "pending",
        paymentProvider: "stripe",
        paymentStatus: "pending",
        fulfillmentStatus: "awaiting_payment",
        items: quote.items,
      });

      try {
        const baseUrl = String(config.storefrontUrl || "").replace(/\/+$/, "");
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          payment_method_types: ["card"],
          line_items: quote.lineItems,
          shipping_options: [{
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: shippingAmountCents, currency: "usd" },
              display_name: String(config.shippingLabel).trim().slice(0, 100),
            },
          }],
          client_reference_id: orderId,
          metadata: { orderId },
          billing_address_collection: "required",
          shipping_address_collection: { allowed_countries: [countryCode] },
          phone_number_collection: { enabled: true },
          success_url: `${baseUrl}/track?orderId=${encodeURIComponent(orderId)}&payment=processing`,
          cancel_url: `${baseUrl}/checkout?payment=cancelled`,
        }, { idempotencyKey: `checkout-${orderId}` });

        order.stripeCheckoutSessionId = session.id;
        await order.save();
        return res.status(200).json({ success: true, checkoutUrl: session.url });
      } catch (error) {
        await Order.updateOne(
          { orderId, status: "pending" },
          { $set: { status: "failed", paymentStatus: "failed" } },
        );
        throw error;
      }
    } catch (error) {
      if (error instanceof Error && /Cart|cart|product|quantity|price|too large/i.test(error.message)) {
        return sendError(res, 400, error.message);
      }
      console.error("Could not create Stripe Checkout session:", error);
      return sendError(res, 502, "Could not start card checkout. Please try again.");
    }
  }

  async function stripeWebhook(req, res) {
    if (!stripe || !config.webhookSecret) {
      return sendError(res, 503, "Stripe webhook is not configured.");
    }
    let event;
    try {
      const signature = req.get("stripe-signature");
      if (!signature || !Buffer.isBuffer(req.rawBody)) {
        return sendError(res, 400, "Stripe signature or raw request body is missing.");
      }
      event = stripe.webhooks.constructEvent(req.rawBody, signature, config.webhookSecret);
    } catch (error) {
      return sendError(res, 400, `Invalid Stripe webhook: ${error.message}`);
    }

    const supportedPaymentEvents = new Set([
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ]);
    if (!supportedPaymentEvents.has(event.type)) {
      if (event.type === "checkout.session.async_payment_failed"
        || event.type === "checkout.session.expired") {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        if (orderId) {
          try {
            await Order.updateOne(
              { orderId, status: "pending", paymentStatus: "pending" },
              { $set: { status: "failed", paymentStatus: "failed", fulfillmentStatus: "not_submitted" } },
            );
          } catch (error) {
            console.error("Could not save failed Stripe payment status:", error);
            return sendError(res, 500, "Stripe event could not be processed.");
          }
        }
      }
      return res.status(200).json({ received: true });
    }

    const session = event.data.object;
    if (session.payment_status !== "paid") {
      return res.status(200).json({ received: true, paymentPending: true });
    }
    const orderId = session.metadata?.orderId;
    if (!orderId || session.client_reference_id !== orderId) {
      return sendError(res, 400, "Stripe session is missing a valid order reference.");
    }

    try {
      const order = await Order.findOne({ orderId });
      if (!order) return sendError(res, 500, "Order is not available for payment reconciliation.");
      if (order.paymentStatus === "paid") {
        return res.status(200).json({ received: true, alreadyProcessed: true });
      }
      const amountMatches = Number(session.amount_total) === Math.round(Number(order.orderTotal) * 100);
      const currencyMatches = String(session.currency || "").toUpperCase() === order.currency;
      if (!amountMatches || !currencyMatches) {
        console.error("Stripe payment amount/currency mismatch; order remains unpaid:", orderId);
        return sendError(res, 400, "Stripe payment does not match the recorded order.");
      }

      const shipping = session.shipping_details || session.collected_information?.shipping_details;
      const shippingAddress = shipping?.address || session.customer_details?.address;
      const customer = session.customer_details || {};
      const update = await Order.updateOne(
        { orderId, status: "pending", paymentStatus: "pending" },
        {
          $set: {
            status: "completed",
            paymentStatus: "paid",
            paymentIntentId: typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
            transactionReference: typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
            customerName: customer.name || shipping?.name || "",
            customerEmail: customer.email || session.customer_email || "",
            customerPhone: customer.phone || "",
            customerAddress: shippingAddress
              ? [shippingAddress.line1, shippingAddress.line2, shippingAddress.city,
                shippingAddress.state, shippingAddress.postal_code, shippingAddress.country]
                .filter(Boolean).join(", ")
              : "",
            fulfillmentStatus: "awaiting_supplier_review",
          },
        },
      );
      if (update.matchedCount === 0) {
        const latest = await Order.findOne({ orderId });
        if (latest?.paymentStatus === "paid") {
          return res.status(200).json({ received: true, alreadyProcessed: true });
        }
        return sendError(res, 500, "Order status could not be updated.");
      }
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Stripe webhook processing failed:", error);
      return sendError(res, 500, "Stripe event could not be processed.");
    }
  }

  return { createCheckout, stripeWebhook };
}

module.exports = { buildStripeQuote, createStripeCheckoutHandlers };
