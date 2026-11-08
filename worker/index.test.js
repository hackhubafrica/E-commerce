import test from "node:test";
import assert from "node:assert/strict";
import worker, { getField, parseJotformPayload } from "./index.js";

function createSupabaseMock() {
  const orders = new Map();
  const fetchMock = async (url, options = {}) => {
    const requestUrl = new URL(url);
    if (!requestUrl.pathname.endsWith("/orders")) {
      return Response.json({ message: "not found" }, { status: 404 });
    }

    const filters = Object.fromEntries(requestUrl.searchParams.entries());
    if (options.method === "POST") {
      const order = JSON.parse(options.body);
      orders.set(order.order_id, { ...order, created_at: "2026-01-01T00:00:00Z" });
      return Response.json([orders.get(order.order_id)]);
    }

    const matched = [...orders.values()].filter((order) => {
      const id = filters.order_id?.replace(/^eq\./, "");
      const email = filters.customer_email?.replace(/^eq\./, "");
      const checkoutRequestId = filters.daraja_checkout_request_id?.replace(/^eq\./, "");
      return (!id || order.order_id === decodeURIComponent(id))
        && (!email || order.customer_email === decodeURIComponent(email))
        && (!checkoutRequestId || order.daraja_checkout_request_id === decodeURIComponent(checkoutRequestId));
    });

    if (options.method === "PATCH") {
      const patch = JSON.parse(options.body);
      for (const order of matched) Object.assign(order, patch);
    }

    const selected = filters.select && filters.select !== "*"
      ? filters.select.split(",")
      : [];
    const data = matched.map((order) => selected.length
      ? Object.fromEntries(selected.filter((key) => key in order).map((key) => [key, order[key]]))
      : order);
    return Response.json(data);
  };
  fetchMock.orders = orders;
  return fetchMock;
}

const env = {
  SUPABASE_URL: "https://database.example",
  SUPABASE_SERVICE_ROLE_KEY: "test-key",
  CORS_ORIGIN: "https://shop.example",
};

test("Jotform form submissions unwrap JSON rawRequest payloads", async () => {
  const form = new FormData();
  form.set("submissionID", "submission-1");
  form.set("rawRequest", JSON.stringify({ orderId: "order-1", orderTotal: "12.50" }));
  const request = new Request("https://worker.example/api/webhook", {
    method: "POST",
    body: form,
  });

  test("Jotform answer fields can be found by their displayed question label", () => {
    const payload = {
      answers: {
        q77: { text: "Select Payment Method", answer: "M-Pesa STK Push" },
        q78: { text: "Phone", answer: "0712345678" },
      },
    };
    assert.equal(getField(payload, "Select Payment Method", "paymentMethod"), "M-Pesa STK Push");
    assert.equal(getField(payload, "phone", "customerPhone", "q4"), "0712345678");
  });

  assert.deepEqual(await parseJotformPayload(request), {
    submissionID: "submission-1",
    rawRequest: JSON.stringify({ orderId: "order-1", orderTotal: "12.50" }),
    orderId: "order-1",
    orderTotal: "12.50",
  });
});

test("card selection creates a pending order, never a falsely completed payment", async (t) => {
  const mock = createSupabaseMock();
  t.mock.method(globalThis, "fetch", mock);
  const request = new Request("https://worker.example/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: "ORD-test",
      orderTotal: "20",
      paymentMethod: "Credit Card (International)",
      email: "buyer@example.com",
      pickupStation: "Westlands",
      items: '{"1":2}',
    }),
  });

  const response = await worker.fetch(request, env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.status, "pending");
  assert.equal(data.deliveryStatus, "pending");
});

test("order tracking verifies email and exposes only safe order fields", async (t) => {
  const mock = createSupabaseMock();
  t.mock.method(globalThis, "fetch", mock);
  await worker.fetch(new Request("https://worker.example/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: "ORD-private",
      orderTotal: "20",
      email: "buyer@example.com",
      pickupStation: "Westlands",
    }),
  }), env);

  const wrongEmail = await worker.fetch(
    new Request("https://worker.example/api/order/ORD-private?email=other%40example.com"),
    env,
  );
  assert.equal(wrongEmail.status, 404);

  const response = await worker.fetch(
    new Request("https://worker.example/api/order/ORD-private?email=buyer%40example.com"),
    env,
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.order.pickup_station, "Westlands");
  assert.equal("customer_email" in data.order, false);
});

test("a customer can change the pickup point before dispatch", async (t) => {
  const mock = createSupabaseMock();
  t.mock.method(globalThis, "fetch", mock);
  await worker.fetch(new Request("https://worker.example/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: "ORD-change",
      orderTotal: "20",
      email: "buyer@example.com",
      pickupStation: "Westlands",
    }),
  }), env);

  const response = await worker.fetch(new Request(
    "https://worker.example/api/order/ORD-change/pickup",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "buyer@example.com",
        pickupStation: "Kilimani",
      }),
    },
  ), env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.order.pickup_station, "Kilimani");
});

test("successful M-Pesa callbacks save payment status and receipt reference", async (t) => {
  const dbFetch = createSupabaseMock();
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    if (String(url).includes("/rest/v1/")) return dbFetch(url, options);
    if (String(url).includes("/oauth/v1/generate")) return Response.json({ access_token: "test-token" });
    if (String(url).includes("/processrequest")) {
      return Response.json({ CheckoutRequestID: "checkout-123", ResponseCode: "0" });
    }
    if (String(url).includes("/stkpushquery/v1/query")) {
      return Response.json({ ResponseCode: "0", ResultCode: 0 });
    }
    return Response.json({}, { status: 404 });
  });
  const mpesaEnv = {
    ...env,
    DARAJA_CONSUMER_KEY: "test-key",
    DARAJA_CONSUMER_SECRET: "test-secret",
    MPESA_SHORTCODE: "174379",
    MPESA_PASSKEY: "test-passkey",
    MPESA_CALLBACK_URL: "https://worker.example/api/mpesa/callback",
  };
  const orderResponse = await worker.fetch(new Request("https://worker.example/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: "ORD-mpesa",
      orderTotal: "20",
      currency: "KES",
      paymentMethod: "M-Pesa STK Push",
      phone: "0712345678",
      email: "buyer@example.com",
      pickupStation: "Westlands",
    }),
  }), mpesaEnv);
  assert.equal(orderResponse.status, 200);

  const callbackResponse = await worker.fetch(new Request("https://worker.example/api/mpesa/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Body: {
        stkCallback: {
          ResultCode: 0,
          CheckoutRequestID: "checkout-123",
          CallbackMetadata: {
            Item: [
              { Name: "MpesaReceiptNumber", Value: "QRS123ABC" },
              { Name: "Amount", Value: 20 },
            ],
          },
        },
      },
    }),
  }), mpesaEnv);
  const callbackData = await callbackResponse.json();
  assert.equal(callbackResponse.status, 200);
  assert.equal(callbackData.ResultCode, 0);

  const tracked = await worker.fetch(
    new Request("https://worker.example/api/order/ORD-mpesa?email=buyer%40example.com"),
    mpesaEnv,
  );
  const trackedData = await tracked.json();
  assert.equal(trackedData.order.status, "completed");
  assert.equal(dbFetch.orders.get("ORD-mpesa").transaction_reference, "QRS123ABC");
});

test("a successful callback with the wrong amount does not complete an order", async (t) => {
  const dbFetch = createSupabaseMock();
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    if (String(url).includes("/rest/v1/")) return dbFetch(url, options);
    if (String(url).includes("/oauth/v1/generate")) return Response.json({ access_token: "test-token" });
    if (String(url).includes("/processrequest")) {
      return Response.json({ CheckoutRequestID: "checkout-mismatch", ResponseCode: "0" });
    }
    if (String(url).includes("/stkpushquery/v1/query")) {
      return Response.json({ ResponseCode: "0", ResultCode: 0 });
    }
    return Response.json({}, { status: 404 });
  });
  const mpesaEnv = {
    ...env,
    DARAJA_CONSUMER_KEY: "test-key",
    DARAJA_CONSUMER_SECRET: "test-secret",
    MPESA_SHORTCODE: "174379",
    MPESA_PASSKEY: "test-passkey",
    MPESA_CALLBACK_URL: "https://worker.example/api/mpesa/callback",
  };
  await worker.fetch(new Request("https://worker.example/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: "ORD-mismatch",
      orderTotal: "20",
      currency: "KES",
      paymentMethod: "M-Pesa STK Push",
      phone: "0712345678",
      email: "buyer@example.com",
      pickupStation: "Westlands",
    }),
  }), mpesaEnv);

  const response = await worker.fetch(new Request("https://worker.example/api/mpesa/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Body: {
        stkCallback: {
          ResultCode: 0,
          CheckoutRequestID: "checkout-mismatch",
          CallbackMetadata: {
            Item: [
              { Name: "MpesaReceiptNumber", Value: "BAD123" },
              { Name: "Amount", Value: 99 },
            ],
          },
        },
      },
    }),
  }), mpesaEnv);

  assert.equal(response.status, 200);
  assert.equal(dbFetch.orders.get("ORD-mismatch").status, "pending");
});

test("a callback is not trusted when Daraja STK Query disagrees", async (t) => {
  const dbFetch = createSupabaseMock();
  dbFetch.orders.set("ORD-unverified", {
    order_id: "ORD-unverified",
    daraja_checkout_request_id: "checkout-unverified",
    order_total: 20,
    currency: "KES",
    mpesa_amount_kes: 20,
    status: "pending",
  });
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    if (String(url).includes("/rest/v1/")) return dbFetch(url, options);
    if (String(url).includes("/oauth/v1/generate")) return Response.json({ access_token: "test-token" });
    if (String(url).includes("/stkpushquery/v1/query")) {
      return Response.json({ ResponseCode: "0", ResultCode: 1032 });
    }
    return Response.json({}, { status: 404 });
  });

  const response = await worker.fetch(new Request("https://worker.example/api/mpesa/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Body: {
        stkCallback: {
          ResultCode: 0,
          CheckoutRequestID: "checkout-unverified",
          CallbackMetadata: {
            Item: [
              { Name: "MpesaReceiptNumber", Value: "FAKE123" },
              { Name: "Amount", Value: 20 },
            ],
          },
        },
      },
    }),
  }), {
    ...env,
    DARAJA_CONSUMER_KEY: "test-key",
    DARAJA_CONSUMER_SECRET: "test-secret",
    MPESA_SHORTCODE: "174379",
    MPESA_PASSKEY: "test-passkey",
  });

  assert.equal(response.status, 503);
  assert.equal(dbFetch.orders.get("ORD-unverified").status, "pending");
});

test("USD orders convert to a configured KES amount before requesting STK", async (t) => {
  const dbFetch = createSupabaseMock();
  let stkPayload;
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    if (String(url).includes("/rest/v1/")) return dbFetch(url, options);
    if (String(url).includes("/oauth/v1/generate")) return Response.json({ access_token: "test-token" });
    if (String(url).includes("/processrequest")) {
      stkPayload = JSON.parse(options.body);
      return Response.json({ CheckoutRequestID: "checkout-usd", ResponseCode: "0" });
    }
    return Response.json({}, { status: 404 });
  });
  const mpesaEnv = {
    ...env,
    DARAJA_CONSUMER_KEY: "test-key",
    DARAJA_CONSUMER_SECRET: "test-secret",
    MPESA_SHORTCODE: "174379",
    MPESA_PASSKEY: "test-passkey",
    MPESA_CALLBACK_URL: "https://worker.example/api/mpesa/callback",
    MPESA_USD_TO_KES_RATE: "130",
  };
  const response = await worker.fetch(new Request("https://worker.example/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: "ORD-usd",
      orderTotal: "20",
      currency: "USD",
      paymentMethod: "M-Pesa STK Push",
      phone: "0712345678",
      email: "buyer@example.com",
      pickupStation: "Westlands",
    }),
  }), mpesaEnv);

  assert.equal(response.status, 200);
  assert.equal(stkPayload.Amount, 2600);
  assert.equal(dbFetch.orders.get("ORD-usd").currency, "USD");
  assert.equal(dbFetch.orders.get("ORD-usd").mpesa_amount_kes, 2600);
});

test("USD M-Pesa requests fail safely when no exchange rate is configured", async (t) => {
  const dbFetch = createSupabaseMock();
  let darajaCalled = false;
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    if (String(url).includes("/rest/v1/")) return dbFetch(url, options);
    if (String(url).includes("/oauth/v1/generate") || String(url).includes("/processrequest")) {
      darajaCalled = true;
    }
    return Response.json({ access_token: "test-token", CheckoutRequestID: "unexpected" });
  });
  const response = await worker.fetch(new Request("https://worker.example/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: "ORD-usd-no-rate",
      orderTotal: "20",
      currency: "USD",
      paymentMethod: "M-Pesa STK Push",
      phone: "0712345678",
      email: "buyer@example.com",
      pickupStation: "Westlands",
    }),
  }), {
    ...env,
    DARAJA_CONSUMER_KEY: "test-key",
    DARAJA_CONSUMER_SECRET: "test-secret",
    MPESA_SHORTCODE: "174379",
    MPESA_PASSKEY: "test-passkey",
    MPESA_CALLBACK_URL: "https://worker.example/api/mpesa/callback",
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.status, "failed");
  assert.equal(darajaCalled, false);
  assert.equal(dbFetch.orders.get("ORD-usd-no-rate").status, "failed");
});
