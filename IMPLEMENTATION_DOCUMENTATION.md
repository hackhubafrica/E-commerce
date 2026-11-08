# Current implementation notes

## Storefront

- Astro generates static storefront routes; the existing React shop hydrates as an island.
- Account requests use `PUBLIC_API_URL`. Copy `backend/.env.example` and configure MongoDB and a private `JWT_SECRET` before running the account API.
- New account passwords use scrypt hashes. Legacy plaintext passwords are upgraded on successful login.
- Jotform checkout pre-fills the order reference, cart quantities, amount, and preferred pickup location.
- `/track` looks up an order by order reference and checkout email through the Worker. Customers can update their preferred pickup point until the order is ready.

## Payment Worker

`worker/index.js` handles Jotform submissions, M-Pesa STK Push requests and callbacks, and order lookup. Orders remain pending until an actual payment confirmation arrives. The selection of a card payment method is not proof of a successful charge; a trusted Stripe/Jotform payment confirmation integration is still needed.

The Worker reads its Supabase and Daraja settings from Cloudflare. Apply
[`supabase-schema.sql`](./supabase-schema.sql) before deploying the Worker, and
follow [`JOTFORM_SETUP.md`](./JOTFORM_SETUP.md) for form and deployment setup.

## Delivery scope

Pickup selection and reference-based tracking are implemented as a manual
workflow. This repository has no courier integration, station directory,
dispatch system, or carrier scan feed. Those require choosing a delivery
provider and configuring its service/API.

## Credentials

Never commit database passwords, API keys, service-role keys, JWT secrets, or
payment-provider secrets. Some older versions of the project documentation
contained credential values. Removing them from the current files does not
remove them from earlier Git history; rotate any credentials that were ever
committed and configure the replacements in the relevant provider's secret
settings.
