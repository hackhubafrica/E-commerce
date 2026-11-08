/**
 * Cloudflare Worker — E-commerce Payment API
 * 
 * Routes:
 *   POST /api/webhook        — Receive Jotform submission, save order, trigger STK Push if M-Pesa
 *   POST /api/mpesa/callback — Receive Daraja STK Push result, update order status
 *   GET  /api/order/:id      — Fetch order status by orderId
 */

function decodeField(value) {
  if (value && typeof value === "object") {
    return decodeField(value.answer ?? value.value ?? value.text ?? "");
  }
  return value == null ? "" : value;
}

function parseRawRequest(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function parseJotformPayload(request) {
  const contentType = request.headers.get("content-type") || "";
  let body;
  if (contentType.includes("application/json")) {
    body = await request.json();
  } else {
    const formData = await request.formData();
    body = Object.fromEntries(formData.entries());
  }

  const rawRequest = parseRawRequest(body.rawRequest);
  return rawRequest && typeof rawRequest === "object"
    ? { ...body, ...rawRequest }
    : body;
}

export function getField(payload, ...keys) {
  const normalizeKey = (key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedKeys = new Set(keys.map(normalizeKey));
  for (const source of [payload, payload?.answers]) {
    if (!source || typeof source !== "object") continue;
    for (const key of keys) {
      const value = decodeField(source[key]);
      if (value !== "") return value;
    }
  }
  if (payload?.answers && typeof payload.answers === "object") {
    for (const field of Object.values(payload.answers)) {
      if (
        field && typeof field === "object"
        && normalizedKeys.has(normalizeKey(field.text || field.name || ""))
      ) {
        const value = decodeField(field);
        if (value !== "") return value;
      }
    }
  }
  return "";
}

function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers (locked to your GitHub Pages domain)
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ------------------------------------------------------------------
    // Helper: Supabase REST API call
    // ------------------------------------------------------------------
    async function supabaseRequest(method, tablePath, body = null, queryParams = "") {
      const res = await fetch(
        `${env.SUPABASE_URL}/rest/v1/${tablePath}${queryParams}`,
        {
          method,
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: body ? JSON.stringify(body) : null,
        }
      );
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    }

    // ------------------------------------------------------------------
    // Helper: Safaricom Daraja OAuth token
    // ------------------------------------------------------------------
    async function getDarajaAccessToken() {
      const baseUrl =
        env.DARAJA_ENVIRONMENT === "production"
          ? "https://api.safaricom.co.ke"
          : "https://sandbox.safaricom.co.ke";

      const auth = encodeBase64(
        `${env.DARAJA_CONSUMER_KEY}:${env.DARAJA_CONSUMER_SECRET}`
      );

      const res = await fetch(
        `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: { Authorization: `Basic ${auth}` },
        }
      );
      if (!res.ok) {
        throw new Error(`Daraja OAuth request failed with status ${res.status}.`);
      }
      const data = await res.json();
      if (!data.access_token) {
        throw new Error("Daraja OAuth response did not contain an access token.");
      }
      return data.access_token;
    }

    async function queryDarajaStk(checkoutRequestId) {
      const baseUrl =
        env.DARAJA_ENVIRONMENT === "production"
          ? "https://api.safaricom.co.ke"
          : "https://sandbox.safaricom.co.ke";
      const accessToken = await getDarajaAccessToken();
      const { timestamp, password } = getDarajaPasswordData();
      const response = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: env.MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        }),
      });
      const data = await response.json();
      if (!response.ok || String(data.ResponseCode) !== "0") {
        throw new Error(data.errorMessage || data.ResponseDescription || "Daraja could not verify the STK result.");
      }
      return data;
    }

    // ------------------------------------------------------------------
    // Helper: Generate Daraja timestamp + password
    // ------------------------------------------------------------------
    function getDarajaPasswordData() {
      const now = new Date();
      const timestamp =
        now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0") +
        String(now.getHours()).padStart(2, "0") +
        String(now.getMinutes()).padStart(2, "0") +
        String(now.getSeconds()).padStart(2, "0");

      const password = encodeBase64(
        `${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`
      );

      return { timestamp, password };
    }

    // ------------------------------------------------------------------
    // Helper: Format phone number to 2547XXXXXXXX (Safaricom requirement)
    // ------------------------------------------------------------------
    function formatPhone(phone) {
      let p = String(phone).trim();
      p = p.replace(/^\+/, ""); // remove leading +
      p = p.replace(/^0/, "254"); // convert 07XX -> 2547XX
      if (!p.startsWith("254")) {
        p = "254" + p;
      }
      return p;
    }

    // ------------------------------------------------------------------
    // Route: POST /api/webhook  (Jotform submission)
    // ------------------------------------------------------------------
    if (path === "/api/webhook" && request.method === "POST") {
      try {
        const payload = await parseJotformPayload(request);
        const orderId = String(getField(payload, "orderId", "order_id", "q1")).trim();
        const customerName = getField(payload, "name", "customerName", "q2");
        const customerEmail = String(getField(payload, "email", "customerEmail", "q3")).trim().toLowerCase();
        const customerPhone = getField(payload, "phone", "customerPhone", "q4");
        const customerAddress = getField(payload, "address", "customerAddress", "q5");
        const paymentMethod = String(getField(payload, "Select Payment Method", "paymentMethod") || "Local Payment / Bank Transfer");
        const orderTotal = Number(getField(payload, "orderTotal", "amount", "q6"));
        const currency = String(getField(payload, "currency", "orderCurrency") || "USD").trim().toUpperCase();
        const transactionReference = getField(payload, "transactionReference", "q7");
        const submissionId = getField(payload, "submissionID", "submission_id");
        const pickupStation = String(getField(payload, "pickupStation", "pickup_station", "pickupStationName")).trim();
        const itemsValue = getField(payload, "items");
        let items = {};
        if (typeof itemsValue === "string" && itemsValue) {
          try {
            items = JSON.parse(itemsValue);
          } catch {
            return jsonResponse({ success: false, error: "Invalid items data" }, 400, corsHeaders);
          }
        } else if (itemsValue && typeof itemsValue === "object") {
          items = itemsValue;
        }

        if (!orderId || !Number.isFinite(orderTotal) || orderTotal <= 0) {
          return jsonResponse(
            { success: false, error: "A valid orderId and orderTotal are required" },
            400,
            corsHeaders
          );
        }
        if (!["KES", "USD"].includes(currency)) {
          return jsonResponse({ success: false, error: "Currency must be KES or USD." }, 400, corsHeaders);
        }
        if (!pickupStation) {
          return jsonResponse(
            { success: false, error: "A pickup station is required" },
            400,
            corsHeaders
          );
        }

        // A selected payment method is not proof that a payment succeeded.
        const status = "pending";
        const existingOrder = await supabaseRequest(
          "GET",
          "orders",
          null,
          `?order_id=eq.${encodeURIComponent(orderId)}&select=order_id,status,delivery_status`
        );
        if (!existingOrder.ok) {
          return jsonResponse({ success: false, error: "Unable to check for an existing order." }, 502, corsHeaders);
        }
        if (existingOrder.data?.length) {
          return jsonResponse(
            {
              success: true,
              message: "Order already received",
              orderId,
              status: existingOrder.data[0].status,
              deliveryStatus: existingOrder.data[0].delivery_status || "pending",
            },
            200,
            corsHeaders
          );
        }

        const insertResult = await supabaseRequest(
          "POST",
          "orders",
          {
            order_id: orderId,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            customer_address: customerAddress,
            payment_method: paymentMethod,
            order_total: orderTotal,
            currency,
            status,
            transaction_reference: transactionReference,
            items,
            submission_id: submissionId,
            pickup_station: pickupStation,
            delivery_status: "pending",
          },
          "?on_conflict=order_id"
        );
        if (!insertResult.ok) {
          console.error("Supabase insert error:", insertResult.data);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to save order" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.log("Order saved to Supabase:", orderId);

        let paymentStatus = status;
        // If M-Pesa STK Push, trigger Daraja immediately.
        if (paymentMethod.includes("M-Pesa") || paymentMethod === "M-Pesa STK Push") {
          try {
            const requiredSettings = [
              "DARAJA_CONSUMER_KEY",
              "DARAJA_CONSUMER_SECRET",
              "MPESA_SHORTCODE",
              "MPESA_PASSKEY",
            ];
            const missingSettings = requiredSettings.filter((key) => !env[key]);
            if (missingSettings.length) {
              throw new Error(`Missing Daraja settings: ${missingSettings.join(", ")}`);
            }
            if (!customerPhone) {
              throw new Error("Missing customer phone number.");
            }
            const formattedPhone = formatPhone(customerPhone);
            if (!/^254[17]\d{8}$/.test(formattedPhone)) {
              throw new Error("The phone number is not a valid Kenyan mobile number.");
            }
            const callbackUrl = env.MPESA_CALLBACK_URL || `${env.WORKER_URL || ""}/api/mpesa/callback`;
            let mpesaAmount;
            if (currency === "KES") {
              mpesaAmount = Math.round(orderTotal);
            } else if (currency === "USD") {
              const usdToKesRate = Number(env.MPESA_USD_TO_KES_RATE);
              if (!Number.isFinite(usdToKesRate) || usdToKesRate <= 0) {
                throw new Error("M-Pesa is disabled for USD orders until MPESA_USD_TO_KES_RATE is configured.");
              }
              mpesaAmount = Math.round(orderTotal * usdToKesRate);
            } else {
              throw new Error(`M-Pesa does not support ${currency} orders.`);
            }
            if (!Number.isSafeInteger(mpesaAmount) || mpesaAmount < 1) {
              throw new Error("The M-Pesa amount must be at least KES 1.");
            }
            let parsedCallbackUrl;
            try {
              parsedCallbackUrl = new URL(callbackUrl);
            } catch {
              throw new Error("A public HTTPS M-Pesa callback URL is required.");
            }
            if (parsedCallbackUrl.protocol !== "https:") {
              throw new Error("A public HTTPS M-Pesa callback URL is required.");
            }
            const accessToken = await getDarajaAccessToken();
            if (!accessToken) throw new Error("Daraja did not return an access token.");
            const { timestamp, password } = getDarajaPasswordData();
            const stkPayload = {
              BusinessShortCode: env.MPESA_SHORTCODE,
              Password: password,
              Timestamp: timestamp,
              TransactionType: "CustomerPayBillOnline",
              Amount: mpesaAmount,
              PartyA: formattedPhone,
              PartyB: env.MPESA_SHORTCODE,
              PhoneNumber: formattedPhone,
              CallBackURL: parsedCallbackUrl.toString(),
              AccountReference: "EcomOrder",
              TransactionDesc: `Payment for order ${orderId}`,
            };
            const baseUrl =
              env.DARAJA_ENVIRONMENT === "production"
                ? "https://api.safaricom.co.ke"
                : "https://sandbox.safaricom.co.ke";
            const darajaRes = await fetch(
              `${baseUrl}/mpesa/stkpush/v1/processrequest`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(stkPayload),
              }
            );
            const darajaData = await darajaRes.json();
            console.log("Daraja STK Push response:", darajaData);
            if (darajaRes.ok && darajaData.CheckoutRequestID) {
              paymentStatus = "pending";
              const updateResult = await supabaseRequest(
                "PATCH",
                `orders?order_id=eq.${encodeURIComponent(orderId)}`,
                {
                  daraja_checkout_request_id: darajaData.CheckoutRequestID,
                  mpesa_amount_kes: mpesaAmount,
                }
              );
              if (!updateResult.ok) {
                throw new Error("Daraja accepted the STK request, but the order could not be linked to its callback.");
              }
            } else {
              throw new Error(darajaData.errorMessage || darajaData.ResponseDescription || "Daraja rejected the STK Push request.");
            }
          } catch (darajaErr) {
            console.error("Daraja STK Push error:", darajaErr);
            paymentStatus = "failed";
            await supabaseRequest(
              "PATCH",
              `orders?order_id=eq.${encodeURIComponent(orderId)}`,
              { status: "failed" }
            );
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Order received",
            orderId,
            status: paymentStatus,
            deliveryStatus: "pending",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Webhook error:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Internal server error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ------------------------------------------------------------------
    // Route: POST /api/mpesa/callback  (Daraja STK Push result)
    // ------------------------------------------------------------------
    if (path === "/api/mpesa/callback" && request.method === "POST") {
      try {
        const callbackData = await request.json();
        const stkCallback = callbackData.Body?.stkCallback;
        if (!stkCallback) {
          return new Response(
            JSON.stringify({ ResultCode: 1, ResultDesc: "Invalid callback" }),
            { status: 400, headers: corsHeaders }
          );
        }
        const { ResultCode, CheckoutRequestID, CallbackMetadata } = stkCallback;
        if (!CheckoutRequestID) {
          return new Response(
            JSON.stringify({ ResultCode: 1, ResultDesc: "Missing checkout request ID" }),
            { status: 400, headers: corsHeaders }
          );
        }
        const queryResult = await supabaseRequest(
          "GET",
          "orders",
          null,
          `?daraja_checkout_request_id=eq.${encodeURIComponent(CheckoutRequestID)}&select=*`
        );
        if (!queryResult.ok) {
          console.error("Could not retrieve order for Daraja callback:", queryResult.data);
          return new Response(
            JSON.stringify({ ResultCode: 1, ResultDesc: "Order lookup failed" }),
            { status: 500, headers: corsHeaders }
          );
        }
        let order = null;
        if (queryResult.data && queryResult.data.length > 0) {
          order = queryResult.data[0];
        }
        if (!order) {
          console.warn("No order found for CheckoutRequestID:", CheckoutRequestID);
          return new Response(
            JSON.stringify({ ResultCode: 0, ResultDesc: "Order not found" }),
            { status: 200, headers: corsHeaders }
          );
        }
        const verifiedResult = await queryDarajaStk(CheckoutRequestID);
        if (String(verifiedResult.ResultCode) !== String(ResultCode)) {
          console.warn("Daraja STK query result did not match callback; order left unchanged:", order.order_id);
          return new Response(
            JSON.stringify({ ResultCode: 1, ResultDesc: "Payment result could not be verified yet" }),
            { status: 503, headers: corsHeaders }
          );
        }
        const callbackItems = CallbackMetadata?.Item || [];
        const receiptNumber = callbackItems.find((item) => item.Name === "MpesaReceiptNumber")?.Value || null;
        const callbackAmount = Number(callbackItems.find((item) => item.Name === "Amount")?.Value);
        const expectedAmount = Number(
          order.mpesa_amount_kes
          ?? (order.currency === "KES" ? Math.round(Number(order.order_total)) : NaN)
        );
        if (
          ResultCode === 0
          && (!receiptNumber || !Number.isSafeInteger(callbackAmount) || callbackAmount !== expectedAmount)
        ) {
          console.error("Successful M-Pesa callback does not match the recorded order amount; order left pending:", order.order_id);
          return new Response(
            JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted for reconciliation" }),
            { status: 200, headers: corsHeaders }
          );
        }
        const newStatus = ResultCode === 0 ? "completed" : "failed";
        const updateResult = await supabaseRequest(
          "PATCH",
          `orders?order_id=eq.${order.order_id}`,
          {
            status: newStatus,
            transaction_reference: receiptNumber,
          }
        );
        if (!updateResult.ok) {
          console.error("Supabase update error:", updateResult.data);
          return new Response(
            JSON.stringify({ ResultCode: 1, ResultDesc: "Update failed" }),
            { status: 500, headers: corsHeaders }
          );
        }
        console.log(`Order ${order.order_id} updated to ${newStatus} (receipt: ${receiptNumber})`);
        return new Response(
          JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
          { status: 200, headers: corsHeaders }
        );
      } catch (error) {
        console.error("Callback error:", error);
        return new Response(
          JSON.stringify({ ResultCode: 1, ResultDesc: "Error" }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // ------------------------------------------------------------------
    // Route: GET /api/order/:id  (Order status lookup)
    // ------------------------------------------------------------------
    const pickupMatch = path.match(/^\/api\/order\/([^\/]+)\/pickup$/);
    if (pickupMatch && request.method === "PATCH") {
      try {
        const orderId = decodeURIComponent(pickupMatch[1]);
        const { email, pickupStation } = await request.json();
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const normalizedStation = String(pickupStation || "").trim();
        if (!normalizedEmail || normalizedStation.length < 2 || normalizedStation.length > 120) {
          return jsonResponse(
            { success: false, error: "Enter the checkout email and a pickup point (2–120 characters)." },
            400,
            corsHeaders
          );
        }

        const existing = await supabaseRequest(
          "GET",
          "orders",
          null,
          `?order_id=eq.${encodeURIComponent(orderId)}&customer_email=eq.${encodeURIComponent(normalizedEmail)}&select=order_id,customer_email,status,delivery_status,pickup_station,currency,order_total,mpesa_amount_kes`
        );
        const order = existing.data?.[0];
        if (!existing.ok) {
          return jsonResponse({ success: false, error: "Unable to look up this order." }, 502, corsHeaders);
        }
        if (!order) {
          return jsonResponse({ success: false, error: "Order reference or email was not recognized." }, 404, corsHeaders);
        }
        if (["ready", "collected", "delivered", "cancelled"].includes(order.delivery_status)) {
          return jsonResponse(
            { success: false, error: "This order's pickup point can no longer be changed." },
            409,
            corsHeaders
          );
        }

        const update = await supabaseRequest(
          "PATCH",
          `orders?order_id=eq.${encodeURIComponent(orderId)}&customer_email=eq.${encodeURIComponent(normalizedEmail)}`,
          { pickup_station: normalizedStation },
          ""
        );
        if (!update.ok) {
          return jsonResponse({ success: false, error: "Unable to update the pickup point." }, 502, corsHeaders);
        }
        return jsonResponse(
          {
            success: true,
            order: {
              order_id: orderId,
              status: order.status,
              delivery_status: order.delivery_status || "pending",
              pickup_station: normalizedStation,
              currency: order.currency || "USD",
              order_total: order.order_total,
              mpesa_amount_kes: order.mpesa_amount_kes,
            },
          },
          200,
          corsHeaders
        );
      } catch (error) {
        console.error("Pickup update error:", error);
        return jsonResponse({ success: false, error: "Unable to update the pickup point." }, 500, corsHeaders);
      }
    }

    const orderMatch = path.match(/^\/api\/order\/([^\/]+)$/);
    if (orderMatch && request.method === "GET") {
      try {
        const orderId = decodeURIComponent(orderMatch[1]);
        const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
        if (!email) {
          return jsonResponse({ success: false, error: "Checkout email is required." }, 400, corsHeaders);
        }
        const result = await supabaseRequest(
          "GET",
          "orders",
          null,
          `?order_id=eq.${encodeURIComponent(orderId)}&customer_email=eq.${encodeURIComponent(email)}&select=order_id,status,delivery_status,pickup_station,currency,order_total,mpesa_amount_kes,created_at`
        );
        if (!result.ok) {
          return jsonResponse({ success: false, error: "Unable to look up this order." }, 502, corsHeaders);
        }
        if (!result.data || result.data.length === 0) {
          return jsonResponse({ success: false, error: "Order reference or email was not recognized." }, 404, corsHeaders);
        }
        return jsonResponse({ success: true, order: result.data[0] }, 200, corsHeaders);
      } catch (error) {
        console.error("Order lookup error:", error);
        return jsonResponse({ success: false, error: "Unable to look up this order." }, 500, corsHeaders);
      }
    }

    // ------------------------------------------------------------------
    // Fallback: 404
    // ------------------------------------------------------------------
    return new Response(
      JSON.stringify({ error: "Route not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  },
};