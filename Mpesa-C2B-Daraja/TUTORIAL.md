# M-PESA DARAJA API - C2B Integration Guide

## Introduction

If you are building a web or mobile app that needs to receive payments from M-PESA customers in Kenya, the Safaricom Daraja API is the tool you need. This guide will walk you through everything from scratch—no prior API experience required.

### By the end of this guide, you will understand:

- What the C2B API is and how it works
- How to set up and test it in the sandbox using Postman
- What ValidationURL and ConfirmationURL do
- How to take your integration live

---

## What is C2B?

**C2B** stands for **Customer to Business**. It refers to the flow of money from an individual customer to your business. When a customer pays your Paybill or Till number via M-PESA, that is a C2B transaction.

The C2B API allows your application to receive real-time notifications every time a payment comes in, so you can automate things like:

- Marking an order as paid
- Sending a payment receipt to the customer
- Updating your accounting system automatically

---

## What is Daraja?

**Daraja** (which means "bridge" in Swahili) is Safaricom's developer portal that gives you access to the M-PESA API. It provides a sandbox (testing) environment where you can simulate payments without using real money, and a production environment for real transactions.

**Portal URL:** https://developer.safaricom.co.ke

---

# PART ONE: SANDBOX TESTING

Before using real money, Daraja gives you a sandbox environment to safely test your integration. This is where you should always start.

## STEP 1 - Create a Daraja Account & App

### Set up your developer profile

1. Go to https://developer.safaricom.co.ke and click **Sign Up**
2. Fill in your details and verify your email address
3. Once logged in, click **"My Apps"** in the top navigation menu
4. Click **"Create Sandbox App"** - give it any name (e.g. "MyShopC2B")
5. Under the products section, check **"M-Pesa Sandbox"** to enable sandbox APIs
6. Click **"Create App"**

Your app will now appear in the "My Apps" section. Click on it and you will see two important values:

| Key | Description |
|-----|-------------|
| Consumer Key | Acts like your app's username for the API |
| Consumer Secret | Acts like your app's password for the API |

💾 **Save These!** Copy your Consumer Key and Consumer Secret somewhere safe. You will need them for every API call.

---

## STEP 2 - Get an Access Token

### Authenticate before making any API call

Every single API request to Daraja requires an access token. Think of it like a temporary password that proves your identity. It expires after 1 hour and you need to generate a new one.

### In Postman:

- **Method:** `GET`
- **URL:** `https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials`

Go to the **Authorization** tab in Postman:

- **Auth Type:** Basic Auth
- **Username:** paste your Consumer Key
- **Password:** paste your Consumer Secret

Click **Send**. You should get a response like this:

```json
{
  "access_token": "SGWcJPtNtYNPGm1DqBNqZZZZZZ",
  "expires_in": "3599"
}
```

📋 **Copy It!** Copy the `access_token` value. You will paste it in the Authorization header of every request below.

---

## STEP 3 - Understanding Your Callback URLs

### The heart of how C2B notifications work

Before registering your URLs, it is important to understand what each one does. When a customer makes a payment, Safaricom contacts your server at two different points in the payment flow:

```
📱 Customer Pays  →  🔍 ValidationURL  →  ✅ ConfirmationURL
  (Sends money)      ("Should I allow    ("Payment done,
                          this?")          record it!")
```

### ValidationURL - "Should I allow this payment?"

This is called **before** the payment is processed. Safaricom sends you the payment details and waits for your response. You can accept or reject the payment based on your own business logic - for example, checking if the account number the customer entered actually exists in your system.

You respond with one of the following:

```json
// Accept the payment
{
  "ResultCode": "0",
  "ResultDesc": "Accepted"
}
```

```json
// Reject the payment
{
  "ResultCode": "C2B00012",
  "ResultDesc": "Rejected"
}
```

⚠️ **Note:** ValidationURL is optional. If you set ResponseType to "Completed" when registering, Safaricom skips validation and auto-accepts all payments. This is recommended for beginners.

### ConfirmationURL - "Payment went through, save the details"

This is called **after** the payment has been successfully processed. At this point, you cannot reject the payment - it has already gone through. This is where your app should record the transaction, update a database, send a receipt, or trigger any other business logic.

| Feature | ValidationURL | ConfirmationURL |
|---------|---------------|-----------------|
| When called | BEFORE payment is processed | AFTER payment is processed |
| Purpose | Accept or reject the payment | Record and act on the payment |
| Your response matters? | YES - can block the payment | NO - informational only |
| Required? | Optional | Yes, always required |

🏪 **Real-world analogy:** Think of it like a supermarket checkout. The ValidationURL is the cashier checking if your loyalty card is valid before ringing up. The ConfirmationURL is the receipt printer - it just records that the sale happened.

---

## STEP 4 - Get a Free Callback URL for Testing

### Use webhook.site to capture callbacks

Your ValidationURL and ConfirmationURL must be publicly accessible HTTPS endpoints. For sandbox testing, you do not need a real server - you can use a free tool called **webhook.site**.

1. Go to https://webhook.site in your browser
2. You will instantly get a unique URL like: `https://webhook.site/abc-123-xyz`
3. Copy that URL - you will use it as both your ValidationURL and ConfirmationURL for testing
4. Leave the webhook.site tab open. Callbacks from Safaricom will appear here in real time

🚫 **URL Rules:** Never use words like "MPesa", "M-Pesa", or "Safaricom" in your URLs - the system will block them. Also, localhost URLs will not work. Always use a proper HTTPS URL.

---

## STEP 5 - Register Your Callback URLs

### Tell Safaricom where to send payment notifications

Now you will call the Register URL API to link your callback URLs to your Paybill shortcode.

### In Postman:

- **Method:** `POST`
- **URL:** `https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl`

**Headers tab** - add these two headers:

| Header Key | Header Value |
|-----------|--------------|
| Authorization | `Bearer YOUR_ACCESS_TOKEN` |
| Content-Type | `application/json` |

⚠️ **Important:** The `Bearer` prefix is required before your access token!

**Body tab** - select "raw" and "JSON", then paste:

```json
{
  "ShortCode": "600584",
  "ResponseType": "Completed",
  "ConfirmationURL": "https://webhook.site/your-unique-url",
  "ValidationURL": "https://webhook.site/your-unique-url"
}
```

| Field | Explanation |
|-------|-------------|
| ShortCode | The sandbox test Paybill number (600584 is the default sandbox shortcode) |
| ResponseType | "Completed" means skip validation and auto-accept all payments |
| ConfirmationURL | Your webhook.site URL - where Safaricom sends payment confirmations |
| ValidationURL | Your webhook.site URL - where Safaricom asks for approval (optional here) |

### Success Response

A successful response looks like:

```json
{
  "OriginatorCoversationID": "...",
  "ResponseCode": "0",
  "ResponseDescription": "success"
}
```

---

## STEP 6 - Simulate a C2B Payment

### Pretend a customer is paying you

Now for the fun part - you will simulate a customer sending money to your Paybill. Safaricom provides a test phone number you can use.

### In Postman:

- **Method:** `POST`
- **URL:** `https://sandbox.safaricom.co.ke/mpesa/c2b/v1/simulate`

Use the same Authorization header as before, then paste this JSON body:

```json
{
  "ShortCode": "600584",
  "CommandID": "CustomerPayBillOnline",
  "Amount": "100",
  "Msisdn": "254708374149",
  "BillRefNumber": "INV001"
}
```

| Field | Explanation |
|-------|-------------|
| ShortCode | Your sandbox Paybill number |
| CommandID | Use "CustomerPayBillOnline" for Paybill, or "CustomerBuyGoodsOnline" for Till |
| Amount | The amount the simulated customer is paying (in KES) |
| Msisdn | The test customer phone number - always use 254708374149 in sandbox |
| BillRefNumber | The account reference - e.g. an invoice number or order ID |

---

## STEP 7 - Check Your Callback

### See what your app would receive

After sending the simulation request, go to your webhook.site tab. Within a few seconds, you should see a POST request arrive. This is exactly the payload your real server would receive when a customer pays.

It will look something like this:

```json
{
  "TransactionType": "Pay Bill",
  "TransID": "UCB030CBG1",
  "TransTime": "20260311161727",
  "TransAmount": "1.00",
  "BusinessShortCode": "600991",
  "BillRefNumber": "account001",
  "InvoiceNumber": "",
  "OrgAccountBalance": "4635316.60",
  "ThirdPartyTransID": "",
  "MSISDN": "bbff37cea44ac0b2d964ee0dfb8d2df8513dc7ba1b36129a929fc3fbd6dd4af4",
  "FirstName": "John"
}
```

| Field | Value | Explanation |
|-------|-------|-------------|
| TransactionType | Pay Bill | The type of transaction. Will be "Pay Bill" for Paybill or "Buy Goods" for Till numbers |
| TransID | UCB030CBG1 | Unique M-PESA transaction ID. Use this as your reference to avoid processing the same payment twice |
| TransTime | 20260311161727 | Timestamp of the transaction in YYYYMMDDHHmmss format. This one means 11 March 2026 at 16:17:27 |
| TransAmount | 1.00 | The amount the customer paid in KES |
| BusinessShortCode | 600991 | Your Paybill or Till number that received the payment |
| BillRefNumber | account001 | The account number the customer entered when paying. Use this to identify which customer or order the payment belongs to |
| InvoiceNumber | (empty) | Optional invoice number. Usually empty for most C2B transactions |
| OrgAccountBalance | 4635316.60 | Your Paybill account balance after this transaction was processed |
| ThirdPartyTransID | (empty) | Used in some integrations for a third-party reference. Usually empty |
| MSISDN | bbff37c... | The customer's phone number. In sandbox it is returned as a hashed/masked value for privacy. |
| FirstName | John | The first name of the customer as registered on M-PESA |

💡 **Tip:** The three most important fields to save in your database are:
- **TransID** (to prevent duplicate processing)
- **BillRefNumber** (to identify the customer/order)
- **TransAmount** (to confirm the correct amount was paid)

In a real application, you would read this JSON payload and use the TransAmount, BillRefNumber, and MSISDN fields to update your database and send a receipt to the customer.

⚠️ **Sandbox Note:** Sandbox callbacks can sometimes be unreliable. If your webhook.site does not receive anything after 30 seconds, try the simulation again. This is a known sandbox issue.

---

## Full C2B Flow Recap

| Step | Action | What Happens |
|------|--------|--------------|
| 1 | Get Token | You authenticate with your Consumer Key & Secret and receive a temporary access token |
| 2 | Register URLs | You tell Safaricom where to send payment notifications |
| 3 | Customer Pays | A real or simulated customer sends money to your Paybill or Till number |
| 4 | Validation | Safaricom hits your ValidationURL asking "should I accept this?" (optional) |
| 5 | Confirmation | Safaricom hits your ConfirmationURL with the full payment details |
| 6 | Your App Acts | Your server reads the payload and updates the database, sends a receipt, etc. |

---

# PART TWO: GOING LIVE

Once your sandbox integration is working correctly, you are ready to go live and process real M-PESA transactions.

## Prerequisites Before Going Live

Make sure you have all of the following before applying for live credentials:

- ✅ A working sandbox integration - all steps above tested and confirmed working
- ✅ A registered and verified Paybill or Till Number from Safaricom
- ✅ An active Safaricom G2 Business Admin account (used to verify your shortcode)
- ✅ A real publicly accessible HTTPS server URL (not localhost, not webhook.site) for your callback URLs
- ✅ Company documentation: Certificate of incorporation, KRA PIN, and directors' IDs (for businesses)

🏢 **Get a Paybill First:** To get a Paybill number, visit a Safaricom shop with your company registration documents. For a Till number, you can apply via the Safaricom self-onboarding portal. Processing takes 24–72 hours.

---

## Step 1 - Register on the Safaricom G2 Portal

The G2 portal (https://org.ke.mpesa.com) is Safaricom's business management platform. You need an account here so Daraja can verify you own the Paybill or Till number you want to use.

1. Send an email to **M-PESABusiness@safaricom.co.ke** requesting a Business Admin account
2. Attach required documents: company registration certificate, KRA PIN, directors' IDs, and a signed board resolution
3. Safaricom will create your G2 account and send login credentials
4. Log in, change your password, and create an "assistant role" user - these credentials will be used in the next step

---

## Step 2 - Confirm Your Sandbox Integration is Solid

Before applying to go live, make sure all of the following are working in sandbox:

- ✅ Access token generation is working
- ✅ URL registration returns a success response
- ✅ Simulated payments are triggering callbacks to your server
- ✅ Your server is responding with the correct 200 OK responses
- ✅ Your database or backend is correctly parsing and saving the callback payload

---

## Step 3 - Click "Go Live" on the Daraja Portal

1. Log into https://developer.safaricom.co.ke
2. Go to "My Apps" and open your app
3. Click the **"Go Live"** button
4. Select **"Verification by Shortcode"** as the method
5. Enter your Paybill/Till shortcode and your G2 assistant user credentials
6. Select the API products you need (e.g. C2B)
7. Upload your test cases - a document showing what you tested and the results
8. Submit your request

⏱️ **Approval Time:** Safaricom typically takes 24–72 hours to review and approve your live request. You will receive your production credentials by email once approved.

---

## Step 4 - Replace Sandbox Credentials with Live Ones

Once approved, update your application to use production values:

| What to Change | Sandbox | Production |
|----------------|---------|-----------|
| API Base URL | `sandbox.safaricom.co.ke` | `api.safaricom.co.ke` |
| Consumer Key | Sandbox key | New live Consumer Key |
| Consumer Secret | Sandbox secret | New live Consumer Secret |
| ShortCode | `600584` (test) | Your actual Paybill/Till number |
| Callback URLs | webhook.site URLs | Your real HTTPS server URLs |

---

## Step 5 - Test a Small Live Transaction

After switching to production credentials, do a small test with real money (e.g. KES 1) to confirm everything works end to end:

1. Pay your Paybill from a real M-PESA number
2. Confirm your ConfirmationURL receives the callback
3. Verify your database is updated correctly
4. Check that the customer receives the expected response or receipt

📝 **Keep Logs:** Always log every transaction in the early stages of going live. Implement retry logic in case of failed callbacks - Safaricom may occasionally retry if your server is slow to respond.

---

## Common Mistakes to Avoid

| # | ❌ Do NOT do this | ✅ Do this instead |
|---|-------------------|-------------------|
| 1 | Include "MPesa" or "Safaricom" in your callback URLs | Use neutral words in your URLs e.g. `/payment/confirm` |
| 2 | Use localhost or 127.0.0.1 as your callback URL | Host your app or use a tunneling tool like Ngrok (sandbox only) |
| 3 | Use webhook.site/ngrok URLs in production | Use a real, stable HTTPS server in production |
| 4 | Apply for all products without knowing what you need | Plan ahead - decide which APIs you need before going live |
| 5 | Forget to renew your access token every hour | Generate a fresh token on each session or add auto-renewal logic |
| 6 | Ignore the callback response format | Always respond with 200 OK and valid ResultCode/ResultDesc |
| 7 | Send Authorization header without "Bearer" prefix | Always use: `Authorization: Bearer YOUR_TOKEN` |

---

## Useful Resources

| Resource | URL |
|----------|-----|
| Daraja Developer Portal | https://developer.safaricom.co.ke |
| Daraja API Documentation | https://developer.safaricom.co.ke/APIs |
| Safaricom G2 Business Portal | https://org.ke.mpesa.com |
| Test Callback Tool | https://webhook.site |
| M-PESA Business Email | M-PESABusiness@safaricom.co.ke |

---

## Next Steps

If you need payment integrations or have questions, reach out to the Safaricom support team.

**Happy building! 🚀**
