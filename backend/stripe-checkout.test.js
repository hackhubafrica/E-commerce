const test = require("node:test");
const assert = require("node:assert/strict");
const { buildStripeQuote, createStripeCheckoutHandlers } = require("./stripe-checkout");

const products = [
  { _id: "111111111111111111111111", name: "Desk organizer", new_price: 18.5, supplier: "cj", supplierProductId: "cj-1", supplierVariantId: "cj-variant-1" },
  { _id: "222222222222222222222222", name: "Cable clips", new_price: 4.25 },
];

function responseHarness() {
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

function orderModel() {
  const orders = new Map();
  return {
    orders,
    async create(order) {
      const saved = { ...order, save: async () => {} };
      orders.set(order.orderId, saved);
      return saved;
    },
    async findOne({ orderId }) {
      return orders.get(orderId) || null;
    },
    async updateOne(filter, update) {
      const order = orders.get(filter.orderId);
      if (!order || order.status !== filter.status || order.paymentStatus !== filter.paymentStatus) {
        return { matchedCount: 0 };
      }
      Object.assign(order, update.$set);
      return { matchedCount: 1 };
    },
  };
}

test("Stripe quote uses current database prices and preserves supplier references", () => {
  const quote = buildStripeQuote(products, { "111111111111111111111111": 2, "222222222222222222222222": 1 });
  assert.equal(quote.totalCents, 4125);
  assert.deepEqual(quote.items[0], {
    productId: "111111111111111111111111",
    name: "Desk organizer",
    quantity: 2,
    unitAmount: 1850,
    supplier: "cj",
    supplierProductId: "cj-1",
    supplierVariantId: "cj-variant-1",
    supplierCost: 0,
  });
  assert.equal(quote.lineItems[0].price_data.unit_amount, 1850);
});

test("Stripe quote rejects invalid quantities and missing catalog products", () => {
  assert.throws(() => buildStripeQuote(products, { "111111111111111111111111": 0 }), /quantity/);
  assert.throws(() => buildStripeQuote(products, { "removed-product": 1 }), /unavailable/);
  assert.throws(
    () => buildStripeQuote([{ ...products[0], supplierVariantId: "" }], { "111111111111111111111111": 1 }),
    /variant must be configured/,
  );
});

test("checkout creates a pending Stripe order using database catalog prices", async () => {
  const orders = orderModel();
  let sessionParams;
  const stripe = {
    checkout: {
      sessions: {
        async create(params) {
          sessionParams = params;
          return { id: "cs_test_123", url: "https://checkout.stripe.test/session" };
        },
      },
    },
  };
  const handlers = createStripeCheckoutHandlers({
    stripe,
    Product: { find: () => ({ lean: async () => products }) },
    Order: orders,
    config: {
      stripeSecretKey: "sk_test_example",
      webhookSecret: "whsec_example",
      allowedShippingCountries: "US,KE",
      shippingAmountCents: "499",
      shippingLabel: "Standard shipping",
      storefrontUrl: "https://shop.example",
    },
  });
  const res = responseHarness();
  await handlers.createCheckout({
    body: { items: { "111111111111111111111111": 1 }, countryCode: "US" },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.checkoutUrl, "https://checkout.stripe.test/session");
  assert.equal(sessionParams.line_items[0].price_data.unit_amount, 1850);
  assert.equal(sessionParams.payment_method_types[0], "card");
  assert.equal(sessionParams.shipping_options[0].shipping_rate_data.fixed_amount.amount, 499);
  const [order] = [...orders.orders.values()];
  assert.equal(order.status, "pending");
  assert.equal(order.orderTotal, 23.49);
  assert.equal(order.productSubtotal, 18.5);
  assert.equal(order.shippingAmount, 4.99);
});

test("checkout refuses CJ stock failures before creating a payment session", async () => {
  const orders = orderModel();
  let sessionCreated = false;
  const handlers = createStripeCheckoutHandlers({
    stripe: { checkout: { sessions: { create: async () => { sessionCreated = true; } } } },
    Product: { find: () => ({ lean: async () => [products[0]] }) },
    Order: orders,
    config: {
      stripeSecretKey: "sk_test_example",
      webhookSecret: "whsec_example",
      allowedShippingCountries: "US,KE",
      shippingAmountCents: "499",
      shippingLabel: "Standard shipping",
      storefrontUrl: "https://shop.example",
    },
    checkSupplierAvailability: async () => {
      throw new Error("Desk organizer is not currently available in the selected country.");
    },
  });
  const res = responseHarness();
  await handlers.createCheckout({
    body: { items: { "111111111111111111111111": 1 }, countryCode: "US" },
  }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(sessionCreated, false);
  assert.equal(orders.orders.size, 0);
});

test("Stripe webhook only queues supplier review after a verified paid session", async () => {
  const orders = orderModel();
  const orderId = "ORD-test";
  orders.orders.set(orderId, {
    orderId,
    status: "pending",
    paymentStatus: "pending",
    orderTotal: 18.5,
    currency: "USD",
    fulfillmentStatus: "awaiting_payment",
  });
  const event = {
    type: "checkout.session.completed",
    data: {
      object: {
        metadata: { orderId },
        client_reference_id: orderId,
        payment_status: "paid",
        amount_total: 1850,
        currency: "usd",
        payment_intent: "pi_test_123",
        customer_details: { name: "Customer", email: "customer@example.com" },
      },
    },
  };
  const handlers = createStripeCheckoutHandlers({
    stripe: { webhooks: { constructEvent: () => event } },
    Product: {},
    Order: orders,
    config: { webhookSecret: "whsec_example" },
  });
  const res = responseHarness();
  await handlers.stripeWebhook({
    rawBody: Buffer.from("{}"),
    get: () => "valid-signature",
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(orders.orders.get(orderId).paymentStatus, "paid");
  assert.equal(orders.orders.get(orderId).status, "completed");
  assert.equal(orders.orders.get(orderId).fulfillmentStatus, "awaiting_supplier_review");
});

test("Stripe webhook leaves the order unpaid when the reported amount differs", async () => {
  const orders = orderModel();
  const orderId = "ORD-test";
  orders.orders.set(orderId, {
    orderId,
    status: "pending",
    paymentStatus: "pending",
    orderTotal: 18.5,
    currency: "USD",
  });
  const event = {
    type: "checkout.session.completed",
    data: {
      object: {
        metadata: { orderId },
        client_reference_id: orderId,
        payment_status: "paid",
        amount_total: 1,
        currency: "usd",
      },
    },
  };
  const handlers = createStripeCheckoutHandlers({
    stripe: { webhooks: { constructEvent: () => event } },
    Product: {},
    Order: orders,
    config: { webhookSecret: "whsec_example" },
  });
  const res = responseHarness();
  await handlers.stripeWebhook({ rawBody: Buffer.from("{}"), get: () => "valid-signature" }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(orders.orders.get(orderId).paymentStatus, "pending");
});
