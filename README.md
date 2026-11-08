# E-Commerce Platform

## Overview

E-Commerce Platform is a full-featured web application designed to facilitate online shopping. This platform allows users to browse products, manage their shopping cart, and complete purchases seamlessly. It aims to provide an intuitive user experience while ensuring security and performance.

## Features

- Browse a sample clothing catalog by category and view product pages.
- Add products to a browser-side cart and redirect to the configured Jotform checkout.
- Manage products through a separate React/Vite admin dashboard and a legacy Express API.
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

## Installation

### Prerequisites

For the storefront, install:

- [Node.js 22.23.4 or newer](https://nodejs.org/)

MongoDB is only required when running the optional legacy backend.

### Storefront

From the repository root, install the locked workspace dependencies and start the Astro development server:

```bash
npm ci
npm run dev
```

The storefront runs at [http://localhost:4321](http://localhost:4321). To create and preview a production build:

```bash
npm run build
npm run preview
npm test
```

The storefront uses Astro to generate static route pages and hydrates the existing React shop as an island. The admin dashboard and backend are separate projects with their own dependencies.

Copy `frontend/.env.example` to `frontend/.env` and set the public API, Worker, and Jotform URLs for your environment. These `PUBLIC_*` values are shipped to browsers; never put credentials or secret keys there.

### Admin dashboard

```bash
cd admin
npm install
npm run dev
```

### Account API

The Express account API is in `backend/`. Copy `backend/.env.example` to `backend/.env`, set a private `JWT_SECRET`, and point `MONGODB_URI` at your MongoDB server, then run:

```bash
cd backend
npm install
npm start
```

New passwords are stored as scrypt hashes. Existing plaintext-password accounts are upgraded to a hash the next time they log in.

### Payment Worker

The Cloudflare Worker in `worker/` receives Jotform webhooks and M-Pesa callbacks. Configure its Supabase and Daraja secrets in Cloudflare, apply `supabase-schema.sql`, and use the exact deployed Worker URL as the Jotform webhook URL. See [JOTFORM_SETUP.md](./JOTFORM_SETUP.md) for the required form fields and deployment checklist.

The Worker can only report a card payment as paid when a trusted payment confirmation is integrated. A Jotform submission alone is not proof of payment.

## Usage

- Navigate to the application in your browser.
- Sign up for a new account or log in if you already have one.
- Browse products, add them to your cart, and complete your purchase.

## Legacy backend endpoints

The Express API listens on port `4000` after it connects to MongoDB. Its routes are not mounted under `/api` unless noted:

- **POST `/signup`** and **POST `/login`**: user authentication
- **GET `/allproducts`**, **POST `/addproduct`**, and **POST `/removeproduct`**: product operations
- **POST `/upload`**: upload a product image; uploaded images are served under `/images`
- **POST `/api/order`**: receive a legacy MongoDB-backed Jotform order submission (the active payment Worker stores orders in Supabase)

The storefront cart is currently held in React state; there are no cart API routes in this backend.

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

The Cloudflare Worker stores Jotform orders in Supabase and starts the Daraja STK Push flow. M-Pesa orders become completed or failed only after the Daraja callback. Card orders remain pending until a trusted card-payment confirmation is integrated; a Jotform submission or selected payment method alone does not confirm payment.

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

