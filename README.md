# E-Commerce Platform

## Overview

E-Commerce Platform is a full-featured web application designed to facilitate online shopping. This platform allows users to browse products, manage their shopping cart, and complete purchases seamlessly. It aims to provide an intuitive user experience while ensuring security and performance.

## Features

- Browse a sample clothing catalog by category and view product pages.
- Add products from the API-backed catalog to a browser-side cart and pay by card through Stripe Checkout.
- Includes a separate React/Vite admin dashboard for managing catalog products.
- Build the storefront as static Astro routes with the React storefront hydrated as an island.

## Technologies Used

- **Storefront**: Astro static output, React islands, React Router, and CSS
- **Admin dashboard**: React and Vite (separate app)

- **Backend**:
  - Node.js
  - Express.js
  - MongoDB for database management
  - Mongoose for object modeling
  - JSON Web Tokens (JWT) for authentication

## Choosing the technology

`npm` is the package manager for JavaScript projects; it is not itself a
website framework or a direct alternative to PHP. It is comparable to
Composer in a PHP project. This repository uses Astro/React for the storefront,
Express/Node for APIs, MongoDB for accounts/catalog products, and a Cloudflare
Worker with Supabase for payment/order callbacks.

| Choice | What it is | Best fit |
|---|---|---|
| Current Node/npm stack | Custom JavaScript application and package manager | Keep the existing Astro islands, React admin, and custom pickup workflow; flexible, but you own integration, security, and operations. |
| PHP framework | Server-side application stack (for example Laravel) | A new custom application where the team prefers PHP; switching means rewriting and re-testing the current features. |
| WordPress + WooCommerce | Content management system plus a ready-made commerce platform | Fastest route to a conventional managed store with existing products/orders/plugins; custom pickup and payment behavior still needs suitable, maintained extensions or custom development. |

For this project, staying with Node/npm is the least disruptive choice. Before
real sales, simplify the number of services and choose one authoritative
product/order source. Switching to PHP or WordPress will not by itself fix
payment configuration, security, or delivery operations.

## Run the application locally

### Requirements

- [Node.js 22.23.4 or newer](https://nodejs.org/)
- A running MongoDB database (local MongoDB or MongoDB Atlas) for customer accounts.

From the repository root, install dependencies:

```bash
npm ci
npm install --prefix backend
npm install --prefix admin
```

Copy `backend/.env.example` to `backend/.env`. Set `MONGODB_URI` to your
MongoDB connection string and replace `JWT_SECRET` with a private random value.
For example, `openssl rand -hex 32` generates one locally. Allow both local
development origins, and set a separate admin email and long password:

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/e-commerce
JWT_SECRET=your-private-random-secret
CORS_ORIGIN=http://localhost:4321,http://localhost:5173
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=use-a-different-long-random-password
PUBLIC_API_URL=http://localhost:4000
```

For the admin app, copy `admin/.env.example` to `admin/.env`. These `.env` files
are local secrets/configuration and should not be committed.

Start each app in its own terminal, from the repository root:

**Terminal 1 — storefront**
```bash
npm run dev
```
Open [http://localhost:4321](http://localhost:4321).

**Terminal 2 — account/product API**
```bash
npm --prefix backend start
```
Wait until it reports that MongoDB connected and the server is running on port
4000. If MongoDB does not connect, the API does not start.

**Terminal 3 — admin dashboard**
```bash
npm --prefix admin run dev
```
Open the URL Vite prints (normally [http://localhost:5173](http://localhost:5173)).

### Customer logins

On the storefront, open **Log in**, then **Create one** to register. Account
data is stored in MongoDB; new passwords are hashed. Existing accounts created
before password hashing are upgraded on successful login.

Optional phone and social sign-in use Firebase Authentication. Set the four
`PUBLIC_FIREBASE_*` values in `frontend/.env` from the Firebase web app config;
these values are public client configuration, not service-account credentials.
Enable Phone, Google, Facebook, and/or Apple in Firebase Authentication and
configure each provider's credentials and authorized domains there. Phone
sign-in uses Firebase's reCAPTCHA and SMS verification and may incur SMS
charges. For backend token verification, provide the Firebase service-account
JSON as a single-line base64 value in the backend-only
`FIREBASE_SERVICE_ACCOUNT_BASE64` setting. Never expose that value in the
frontend. Without this backend setting, email/password login continues to work
and Firebase sign-in is unavailable.

### Admin access and product uploads

Open the admin app at [http://localhost:5173](http://localhost:5173), then log
in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `backend/.env`. This is a
single-admin local setup; it does not create administrator accounts in the
customer sign-up system. Admin product writes require the API-issued admin JWT.

Products saved in MongoDB appear in the storefront catalog after its catalog
request succeeds. You can upload products manually or search/import a product
from CJ in **Add Products** after configuring `CJ_API_KEY` in the backend.
Supplier credentials stay on the backend. Imported supplier cost is shown to
the admin, who must choose the retail price. CJ imports are snapshots: current
catalog prices are not periodically synchronized. Before Stripe Checkout, the
backend rechecks the selected variant's inventory and supplier cost for the
customer's destination country. Imported products still need a configured
shipping price and manual supplier review before fulfillment.
Product images uploaded manually are stored under `backend/upload/images/`;
that local folder is ignored by Git. A production deployment must use durable
object storage for images, configure `PUBLIC_API_URL` and
`PUBLIC_STOREFRONT_URL`, and use HTTPS.

### Card payments with Stripe

The storefront creates a Stripe-hosted Checkout Session through the backend.
The backend fetches current MongoDB product prices and builds the amount itself;
the browser's cart total is only an estimate. Card numbers go directly to
Stripe. Set these **backend-only** settings from Stripe's test-mode dashboard:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_ALLOWED_SHIPPING_COUNTRIES` (comma-separated ISO country codes you
  actually serve)
- `STRIPE_SHIPPING_AMOUNT_CENTS` and `STRIPE_SHIPPING_LABEL` (the flat shipping
  charge displayed by Stripe; configure a rate you have actually verified)
- `PUBLIC_STOREFRONT_URL`

For local testing, use the Stripe CLI to forward
`/api/payments/stripe/webhook` to the local API and use the webhook secret it
prints. The endpoint verifies Stripe signatures and only marks an order paid
when Stripe reports a successful payment with the exact stored amount and
currency. The admin **Paid orders** list only contains these confirmed orders.
It is a review queue; placing an order with CJ is deliberately not automatic.
Before supplier ordering is automated, configure product variants, a supported
shipping method, destination validation, inventory checks, and an explicit
supplier-account payment policy.

Stripe Checkout and CJ can be developed without Shopify. A self-hosted site
does not make the business cost-free: payment processing, supplier products
and shipping, customs/taxes, and possibly a domain, hosting, database, SMS, or
email provider can incur charges. Stripe merchant onboarding and available
payment methods depend on the merchant's country and account eligibility.

### CJ Dropshipping

The admin can search and import CJ catalog entries using the backend's
`CJ_API_KEY`. Create an API key in CJ and set it only in `backend/.env` or the
backend host's secret store. The [CJ API docs](https://developers.cjdropshipping.com/)
describe token authentication, catalog search, inventory queries, order
creation, and shipping workflows. This project's current CJ integration only
searches/imports products and checks variant stock/cost for the selected
destination immediately before checkout. It does not periodically sync the
catalog, calculate the supplier's shipping price, or place supplier orders.

### M-Pesa and account options

The old Jotform/Cloudflare Worker M-Pesa route is separate from Stripe and has
not been connected to the new server-priced cart checkout. Do not accept
production M-Pesa orders until the Worker validates product IDs, quantities,
and totals against trusted catalog data and the Safaricom sandbox flow has been
tested end-to-end.

Customer login supports email/password and optional Firebase phone, Google,
Facebook, and Apple sign-in. These options require Firebase/provider setup as
described above; no provider credentials are included in the repository.

Never put Stripe, Daraja, CJ, or Supabase secrets in `frontend/.env`:
`PUBLIC_*` values are visible to everyone using the site.

Run local checks with:
```bash
npm test
npm run build
```
These checks use mocks; they do not prove MongoDB, Stripe, CJ, Jotform,
Supabase, Cloudflare, or Safaricom integrations are working.

## API routes

The Express API listens on port `4000` after MongoDB connects:

- **POST `/signup`** and **POST `/login`**: email/password customer authentication
- **POST `/auth/firebase`**: verify a Firebase ID token and issue the store's
  customer JWT; requires backend Firebase service-account configuration
- **POST `/admin/login`** and **GET `/admin/session`**: configured admin login/session check
- **GET `/allproducts`**, **POST `/addproduct`**, **POST `/removeproduct`**,
  **POST `/upload`**: product catalog; write routes require an admin token
- **POST `/api/checkout/stripe`**: create a card Checkout Session using current MongoDB prices
- **POST `/api/payments/stripe/webhook`**: verify and process Stripe payment events
- **GET `/admin/cj/products`** and **POST `/admin/cj/import`**: server-side CJ catalog search/import; require admin token
- **GET `/admin/orders/paid`**: confirmed Stripe orders awaiting manual supplier review; requires admin token
- **POST `/api/order`**: legacy MongoDB Jotform webhook; do not use for card payments.

The storefront loads admin-managed products from the MongoDB API and retains
the bundled sample catalog as a fallback. The cart is held in browser memory
and clears on refresh; persistent customer carts are not implemented.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch: `git checkout -b feature/YourFeature`.
3. Make your changes and commit them: `git commit -m 'Add some feature'`.
4. Push to the branch: `git push origin feature/YourFeature`.
5. Create a new Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

## Acknowledgements

- [Express.js](https://expressjs.com/) for building the server.
- [MongoDB](https://www.mongodb.com/) for the database.
- [React](https://reactjs.org/) for the frontend framework.

## Contact

For any questions, please reach out to [crimsonsummer81@gmail.com](crimsonsummer81@gmail.com).


---

## Payment and delivery status

The Cloudflare Worker stores Jotform orders in Supabase and starts the Daraja STK Push flow. It checks successful callbacks against Daraja's STK Query result and expected M-Pesa amount before marking an order completed. A missing/mismatched amount remains pending for investigation. Stripe card orders are created in MongoDB and marked paid only by a matching, signature-verified Stripe webhook. The live Stripe, Safaricom, and supplier integrations still require sandbox testing before real orders.

The legacy M-Pesa tracking flow supports a manually entered pickup point.
Stripe orders collect a shipping address but do not yet have courier dispatch,
a live pickup-station directory, carrier integration, or shipment scan feed.

---

## Additional Free-Tier Databases (You Can Have Several)

You can use multiple free databases simultaneously — there is no limit to how many you can provision. Below are options beyond Supabase:

| Database | Free Tier | Best For |
|----------|-----------|----------|
| **Supabase** (active) | 500 MB DB, 1 GB file storage, 50k monthly active users | Primary e-commerce DB (already configured) |
| **Firebase Firestore** | 1 GB storage, 50k reads/day, 20k writes/day | Alternative document DB, client-side SDK |
| **MongoDB Atlas M0** | 512 MB storage, shared RAM, no expiration | Document storage, familiar JSON structure |
| **Upstash Redis** | 256 MB storage, 10,000 requests/day | Caching, session storage, rate limiting |
| **Neon Postgres** | 0.5 GB storage, 100 compute hours/month | Serverless Postgres with database branching |
| **Turso (libSQL)** | 5 GB storage, 500M reads/month, 100 databases | Edge SQLite, extremely low latency |
| **Fauna** | 5 GB storage, 100k read ops/month | Document-relational, GraphQL/HTTP API |
| **Aiven** | 1 VM, 1 CPU, 1 GB RAM, 1–5 GB storage | Managed MySQL/PostgreSQL/Valkey |

### Recommendation
Use **one primary database** for your application. Add additional databases only when you have a specific need.

