# Jotform, Payments, and Pickup-Point Setup

The storefront redirects customers to the Jotform master form. Jotform submits
the order to the Cloudflare Worker, which stores it in Supabase and starts an
M-Pesa STK Push when that payment method is selected.

## 1. Configure the order database

Run [`supabase-schema.sql`](./supabase-schema.sql) in the active Supabase
project. The script adds pickup and delivery status fields and removes the old
public order-read/insert policies. The Worker accesses the database using its
service-role key; do not put that key in the storefront.

## 2. Configure Jotform

On the master form, create fields with these names:

- `orderId` (hidden short text)
- `orderTotal` (hidden short text)
- `items` (hidden long text)
- `pickupStation` (short text)
- Customer name, email, phone, and address
- `Select Payment Method` with the exact option `M-Pesa STK Push` for mobile
  money; keep the other payment option labels consistent with the form

The checkout sends the order reference, total, cart quantities, and preferred
pickup point as URL-prefill values. Ensure the corresponding fields in the
master form accept those values. Add the form's actual payment fields and
conditional logic in Jotform.

Under **Settings → Integrations → Webhooks**, set the URL to:

```text
https://YOUR-WORKER.workers.dev/api/webhook
```

In the Jotform thank-you message, show the order reference and link customers
to `https://YOUR-SHOP/track`. They need the same email address used on the form.
For assistance, include the order reference and checkout email in their
confirmation.

## 3. Configure and deploy the Worker

Set the following Cloudflare Worker variables/secrets. Values marked secret
must only be stored in Cloudflare's secret settings:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (secret)
- `WORKER_URL`
- `CORS_ORIGIN`
- `DARAJA_ENVIRONMENT` (`sandbox` while testing)
- `DARAJA_CONSUMER_KEY` (secret)
- `DARAJA_CONSUMER_SECRET` (secret)
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY` (secret)
- `MPESA_CALLBACK_URL` (`https://YOUR-WORKER.workers.dev/api/mpesa/callback`)

Deploy `worker/index.js` using the repository's `wrangler.toml`, then set the
deployed URL in `frontend/.env` as `PUBLIC_WORKER_URL`. Set the form URL as
`PUBLIC_JOTFORM_URL`, and set the account API origin as `PUBLIC_API_URL`.
`PUBLIC_*` settings are visible in the browser; never put secrets in them.

## 4. Payment status limitations

The Worker accepts Jotform JSON and form-encoded submissions. An order starts
as `pending`; selecting a card option does **not** prove that a card payment
succeeded. A verified Stripe/Jotform payment notification still needs to be
connected before card orders can safely become `completed`. Do not manually
change this to trust a customer-provided form field.

For M-Pesa, the Worker sends the STK Push request and updates the order from
Safaricom's callback. A failed STK request or callback is recorded as failed.
The Daraja sandbox requires working Cloudflare secrets and a publicly
reachable callback URL; local code tests cannot verify those external settings.

## 5. Pickup and tracking behavior

Customers enter a preferred pickup station/area before leaving for Jotform.
They can look up an order at `/track` using its reference and checkout email,
and can change the preferred point until delivery is marked ready. This is a
manual preferred-location flow, not a connection to a courier network: the
store must confirm the point and update delivery progress. A live station
directory, courier dispatch, maps, and automatic shipment scans require a
chosen delivery provider and its API.

## Local checks

From the repository root:

```bash
npm test
npm run build
```

The tests cover form payload parsing, safe card-payment status, pickup changes,
and the M-Pesa callback. They do not contact Jotform, Supabase, Stripe, or
Safaricom.
