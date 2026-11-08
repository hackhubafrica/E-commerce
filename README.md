# E-Commerce Platform

## Overview

E-Commerce Platform is a full-featured web application designed to facilitate online shopping. This platform allows users to browse products, manage their shopping cart, and complete purchases seamlessly. It aims to provide an intuitive user experience while ensuring security and performance.

## Features

- Browse a sample clothing catalog by category and view product pages.
- Add products from the API-backed catalog to a browser-side cart and redirect to the configured Jotform checkout.
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

### Admin access and product uploads

Open the admin app at [http://localhost:5173](http://localhost:5173), then log
in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `backend/.env`. This is a
single-admin local setup; it does not create administrator accounts in the
customer sign-up system. Admin product writes require the API-issued admin JWT.

Products saved in MongoDB appear in the storefront catalog after its catalog
request succeeds. Product images are stored under `backend/upload/images/`;
that local folder is ignored by Git. A production deployment must use durable
object storage for images rather than an ephemeral server disk, configure
`PUBLIC_API_URL` to the public API origin, and use HTTPS.

### M-Pesa payments and the missing STK prompt

**The payment pipeline has not been verified against Safaricom and should not
yet be treated as working for real payments.** The automated Worker test
simulates Daraja responses; it does not send an actual STK prompt. An STK request
is started only after Jotform submits the order to the deployed Cloudflare
Worker with the exact payment option `M-Pesa STK Push`, a valid Kenyan phone
number, and all required Worker secrets. Starting the local storefront and API
does not start the payment Worker.

Storefront prices are displayed in USD. The checkout sends a `currency=USD`
prefill, and the Worker will now refuse to send a USD order to Daraja unless
`MPESA_USD_TO_KES_RATE` is configured; when configured, it rounds the converted
amount to whole KES and records that amount for tracking. This is a manually
maintained rate, not a live FX quote. Prefer pricing in KES for a Kenya-first
store, or set and regularly update an agreed conversion rate before sandbox
testing.

The Worker still receives totals/items from a Jotform submission; those values
must be verified against a trusted server-side order before real charges. Do
not accept live payments until the Jotform/Worker flow is tested end to end,
the submitted order amount is verified, and Safaricom confirms the callback.

To investigate a missing sandbox prompt:

1. Confirm the Jotform payment option's exact text is `M-Pesa STK Push` and that
   the form sends the customer's phone number and order total.
2. Confirm Jotform's webhook points to the deployed Worker URL ending in
   `/api/webhook`.
3. In Cloudflare, check Worker logs immediately after submitting the form.
   Look for `Daraja STK Push error`, missing-setting errors, an invalid phone
   number, or a Daraja response without `CheckoutRequestID`.
4. Verify the Worker has sandbox credentials and matching shortcode/passkey,
   Supabase URL/service-role secret, public HTTPS callback URL, and the correct
   `WORKER_URL`. For USD checkout totals, set `MPESA_USD_TO_KES_RATE` to the
   sandbox conversion you intend to use. Use a Daraja sandbox test phone
   supported by the configured sandbox account.
5. Confirm the Worker can reach Supabase and that `supabase-schema.sql` has
   been applied. A saved order alone does not mean Daraja accepted the STK
   request.

The Worker marks payment completed only when a successful Daraja callback
arrives, Daraja's STK Query confirms the result, and the callback amount matches
the expected amount. Card payments remain pending until a trusted card-payment
confirmation is connected. See [JOTFORM_SETUP.md](./JOTFORM_SETUP.md) for
Worker and Jotform setup details. Never put Daraja or Supabase secrets in `frontend/.env`:
`PUBLIC_*` values are visible to everyone using the site.

Run local checks with:
```bash
npm test
npm run build
```
These checks use mocks; they do not prove MongoDB, Jotform, Supabase,
Cloudflare, or Safaricom integrations are working.

## API routes

The Express API listens on port `4000` after MongoDB connects:

- **POST `/signup`** and **POST `/login`**: customer authentication
- **POST `/admin/login`** and **GET `/admin/session`**: configured admin login/session check
- **GET `/allproducts`**, **POST `/addproduct`**, **POST `/removeproduct`**,
  **POST `/upload`**: product catalog; write routes require an admin token
- **POST `/api/order`**: legacy MongoDB order hook; active checkout uses the
  Cloudflare Worker and Supabase instead.

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

The Cloudflare Worker stores Jotform orders in Supabase and starts the Daraja STK Push flow. It checks successful callbacks against Daraja's STK Query result and expected M-Pesa amount before marking an order completed. A missing/mismatched amount remains pending for investigation. Card orders remain pending until a trusted card-payment confirmation is integrated; a Jotform submission or selected payment method alone does not confirm payment. The live Safaricom integration and trusted server-side order-price verification still require end-to-end testing before real charges.

Customers may provide a preferred pickup point at checkout and change it through `/track` until the order is ready. This is a manual workflow: there is no courier, live pickup-station directory, dispatch integration, or automatic shipment scan feed in this repository yet.

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

