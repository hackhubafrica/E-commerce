# M-PESA Daraja C2B Integration

A production-ready Node.js integration for receiving M-PESA payments via the Safaricom Daraja C2B API.

---

## Project Structure

```
mpesa-c2b/
├── index.js                          # Server entry point
├── .env                              # Environment variables (DO NOT commit)
├── src/
│   ├── app.js                        # Express app setup
│   ├── routes/
│   │   └── index.js                  # All API routes
│   ├── controllers/
│   │   ├── callback.controller.js    # Handles Safaricom callbacks
│   │   └── admin.controller.js       # Admin/dev helper endpoints
│   ├── services/
│   │   └── mpesa.service.js          # Daraja API calls + token caching
│   └── utils/
│       ├── logger.js                 # Winston logger
│       └── transactionStore.js       # In-memory transaction store
└── logs/
    ├── combined.log
    └── error.log
```

---

## Quick Start

```bash
npm install
npm start         # production
npm run dev       # development (auto-restarts on file changes, Node 18+)
```

---

## API Endpoints

### Safaricom Callback URLs (register these with Daraja)
| Method | URL | Description |
|--------|-----|-------------|
| POST | `/payment/validation` | Called before payment is processed |
| POST | `/payment/confirmation` | Called after payment is processed |

### Admin / Dev Helpers
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/admin/token` | Generate a fresh access token |
| POST | `/admin/register-urls` | Register callback URLs with Safaricom |
| POST | `/admin/simulate` | Simulate a C2B payment (sandbox only) |
| GET | `/admin/transactions` | List all saved transactions |
| GET | `/health` | Server health check |

---

## Step-by-Step Usage

### 1. Generate a Token
```bash
curl http://localhost:3000/admin/token
```

### 2. Register Your URLs
```bash
curl -X POST http://localhost:3000/admin/register-urls
```

### 3. Simulate a Payment
```bash
curl -X POST http://localhost:3000/admin/simulate \
  -H "Content-Type: application/json" \
  -d '{ "amount": 100, "msisdn": "254700000000", "billRefNumber": "INV001" }'
```

### 4. View Saved Transactions
```bash
curl http://localhost:3000/admin/transactions
```

### 5. Validation Endpoint
```bash
curl -X POST http://localhost:3000/payment/validation \
  -H "Content-Type: application/json" \
  -d '{"BillRefNumber":"123","TransAmount":100}'
```

**Expected Response:**
```json
{
  "ResultCode": "0",
  "ResultDesc": "Accepted"
}
```

### 6. Confirmation Endpoint
```bash
curl -X POST http://localhost:3000/payment/confirmation \
  -H "Content-Type: application/json" \
  -d '{
    "TransID":"LHD221209DZ7F5AEC",
    "BillRefNumber":"INV-001",
    "MSISDN":"254712345678",
    "TransAmount":1000,
    "TransactionTimestamp":"20231221093500",
    "Result":"0"
  }'
```

**Expected Response:**
```json
{
  "ResultCode": "0",
  "ResultDesc": "Success"
}
```

---

## Testing Callbacks Locally with Ngrok

By default, Safaricom cannot reach `localhost:3000` because it is not publicly accessible.
You need **ngrok** to create a temporary public tunnel to your local server.

### Why ngrok is needed

```
Safaricom → needs public HTTPS URL → ngrok tunnel → localhost:3000
```

Without ngrok, Safaricom sends the confirmation to webhook.site (or wherever you registered),
and your local server never receives it — so `/admin/transactions` stays empty.

### Setup

**Step 1 — Download ngrok**
Go to https://ngrok.com/download, create a free account, and install it.

**Step 2 — Start ngrok in a separate terminal**
```bash
ngrok http 3000
```

You will see output like:
```
Forwarding  https://xxxx-xxx-xxx-xxx-xxx.ngrok-free.app -> http://localhost:3000
```

Copy that `https://...ngrok-free.app` URL.

**Step 3 — Update your `.env`**
```env
CONFIRMATION_URL=https://xxxx-xxx-xxx-xxx-xxx.ngrok-free.app/payment/confirmation
VALIDATION_URL=https://xxxx-xxx-xxx-xxx-xxx.ngrok-free.app/payment/validation
```

**Step 4 — Restart your server**
```bash
Ctrl+C then npm start
```

**Step 5 — Run the full sequence**
```bash
# Register the ngrok URLs with Safaricom
curl -X POST http://localhost:3000/admin/register-urls

# Simulate a payment
curl -X POST http://localhost:3000/admin/simulate \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "msisdn": "254700000000", "billRefNumber": "INV001"}'

# Wait 5-10 seconds, then check
curl http://localhost:3000/admin/transactions
```

**Step 6 — Confirm it worked**

Watch your server terminal. When Safaricom hits your confirmation URL you will see:
```
info: ConfirmationURL hit — payment received!
info: Transaction saved
```

And `GET /admin/transactions` will return the payment data.

### Important ngrok rules

| Rule | Detail |
|------|--------|
| URL changes on every restart | Every time you restart ngrok you get a new URL — update `.env` and re-register |
| Always re-register after URL change | Safaricom keeps the old URL until you call `/admin/register-urls` again |
| Never use ngrok in production | Use a real hosted HTTPS server URL in production |
| Keep ngrok running | Do not close the ngrok terminal during testing |

---

## Confirmation Payload (What Safaricom sends you)

```json
{
  "TransactionType": "Pay Bill",
  "TransID": "UCB030CBG1",
  "TransTime": "20260311161727",
  "TransAmount": "100.00",
  "BusinessShortCode": "600584",
  "BillRefNumber": "INV001",
  "InvoiceNumber": "",
  "OrgAccountBalance": "4635316.60",
  "ThirdPartyTransID": "",
  "MSISDN": "254700000000",
  "FirstName": "John"
}
```

Key fields to always save:
- **TransID** — unique M-PESA reference (use this to prevent duplicate processing)
- **BillRefNumber** — the account/order the customer entered
- **TransAmount** — the amount paid

---

## Going Live

1. Replace `.env` values:
   - `MPESA_BASE_URL` → `https://api.safaricom.co.ke`
   - `CONSUMER_KEY` / `CONSUMER_SECRET` → your live credentials
   - `SHORTCODE` → your real Paybill or Till number
   - `CONFIRMATION_URL` / `VALIDATION_URL` → your real HTTPS server URLs

2. Set `NODE_ENV=production` to disable the simulate endpoint.

3. Replace `transactionStore.js` with a real database (PostgreSQL, MongoDB, etc.).

---

## Security Notes

- Never commit your `.env` file — add it to `.gitignore`
- Always validate `BillRefNumber` against your own records before accepting payment
- Log every incoming callback for audit purposes
- Implement idempotency using `TransID` to prevent double-processing