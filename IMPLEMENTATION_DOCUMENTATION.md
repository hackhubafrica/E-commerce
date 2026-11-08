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



I’ll trace the login, button, and payment flows first, then check how the storefront and backend can support pickup locations and order tracking without copying Killimall’s proprietary design.

I found a definite login bug: the form sends name, but the backend saves username, so new account names are lost. I’m checking the webhook configuration and inert buttons next; the delivery and payment pieces need to match the actual backend, not just look clickable.



The payment breakage is also in the code: the Worker expects JSON from Jotform, but Jotform submissions may be form-encoded, and it currently marks card orders paid just because “card” was selected. I’m fixing those states and making account errors visible instead of silently treating a response as a successful login.


The account form is now wired to the backend’s actual field names, legacy accounts can still log in while their passwords are upgraded, and login failures are shown plainly. I’ve also removed the fake promo/newsletter controls and added checkout pickup and tracking screens; I’m connecting those screens to the payment Worker and database now.


I found a definite M‑Pesa callback bug too: on successful payment, the Worker references an undefined transaction variable, so it can fail before saving the receipt. I’m fixing that and adding a callback regression test, alongside the setup steps needed for pickup tracking.



A test run exposed an environment mismatch: the old React test runner can’t parse Astro’s import.meta variables, and the build command is currently picking up the legacy React build script instead of Astro. I’m resolving the shared config and workspace scripts before continuing so local development, tests, and production builds all use the same setup.



The restored Astro build now gets far enough to catch a real server-rendering bug on the tracking page: it reads window before the browser loads. I’m fixing that browser-only access, then I’ll rerun the build and inspect the remaining changes for anything else blocking the promised flows.




The tracking page now prerenders, and Astro successfully builds all 44 routes. I’m doing a final smoke check of the built storefront and its environment/configuration wiring, then I’ll rerun the full tests against the finished code.




The build is clean; the browser smoke test hit an npm argument-forwarding quirk in the root wrapper, not an application failure. I’m starting Astro directly through its workspace script so I can check the actual rendered pages.


The mobile smoke check found no horizontal overflow, and the menu does open. It did show the menu button shrinking below a comfortable tap size on narrow phones, so I’m making that target stay 44px and reclaiming the space from header gaps/text before rerunning the phone-width check



Restored the root Astro workspace and lockfile, made the tracking page safe to prerender, improved mobile navigation sizing/overflow, and clarified login network errors. The Astro build succeeds with all 44 routes; all 12 frontend/backend/Worker tests pass, and the 375px/390px browser check shows no horizontal overflow. Changes are still in the existing staged/unstaged worktree; I did not commit or alter staging. External MongoDB, Jotform, payment-provider, Supabase, and courier integrations still need configuration/testing. npm reports 75 dependency advisories, including 4 critical; I did not apply risky broad upgrades.



ompleted the project recovery pass: added protected admin login/product management, connected MongoDB products to the storefront, improved the payment callback checks, and updated the startup/payment guidance in README.md and JOTFORM_SETUP.md. Verification passed: all tests, storefront/admin builds, admin lint, JavaScript syntax checks, and diff checks. Git is no longer tracking node_modules or build output, and there are no staged dependency files. Real Safaricom/Jotform/Supabase flows still need sandbox testing; do not take real payments until Jotform totals are verified against trusted server-side prices, and rotate any credentials that were previously committed.




When building a commercial financial and e-commerce website that handles global card payments (Visa/Mastercard via **Stripe**) alongside local mobile money payments (**Safaricom Daraja API** for M-Pesa), your tech stack needs to prioritize **security, asynchronous webhook handling, fault tolerance, and clean state management** (since M-Pesa callbacks rely heavily on server-to-server notifications).

Because Stripe and Safaricom Daraja are both RESTful APIs, virtually any modern backend framework can handle them. However, certain combinations offer exceptional synergy, rich community packages, and stability.

### Recommended Full-Stack Architecture

#### 1. Frontend (Client-Side)
Your frontend needs to be fast, responsive, and capable of handling dynamic carts, user accounts, and localized checkout forms.

- **Framework:** **React.js (Next.js)** or **Vue.js (Nuxt.js)**.

- *Why Next.js / Nuxt.js:* Server-Side Rendering (SSR) or Static Site Generation (SSG) is crucial for e-commerce SEO. Next.js also provides built-in API routes, which makes handling lightweight backend server logic or proxying webhook endpoints much cleaner.
- **Styling & UI:** **Tailwind CSS** paired with headless UI libraries (like Shadcn UI or Radix UI) for modern, accessible checkout forms.
- **Payment SDKs:**

- `@stripe/stripe-js` and `@stripe/react-stripe-js` for handling secure card tokenization and Stripe Elements.

#### 2. Backend (Server & API Layer)
The backend is the nerve center. It must securely store API secrets (Stripe Secret Keys, Daraja Consumer Secret/Passkeys), securely generate OAuth tokens for Safaricom, trigger STK pushes, and process asynchronous callbacks.

- **Option A (JavaScript/TypeScript):** **Node.js with Express.js** or **NestJS**.

- *Why:* JavaScript/TypeScript allows end-to-end type safety (e.g., sharing TypeScript interfaces for order payloads between frontend and backend). NestJS is especially robust for enterprise-grade modular architecture.
- **Option B (Python):** **FastAPI** or **Django (with Django REST Framework)**.

- *Why:* Excellent for heavy data handling, asynchronous requests, and clean built-in ORMs. Python also features clean wrapper libraries for Daraja.
- **Option C (PHP):** **Laravel**.

- *Why:* Laravel is a powerhouse for e-commerce (the backbone of platforms like WooCommerce and tailored stores) with extensive community packages already built for M-Pesa Daraja and Stripe.

#### 3. Database & Caching Layer
Financial transactions require strict transactional integrity (ACID compliance) to prevent double-spending or unfulfilled orders caused by network drops.

- **Primary Database:** **PostgreSQL** or **MySQL**.

- *Why:* Relational databases are mandatory for tracking users, products, orders, and immutable financial transaction logs. PostgreSQL offers powerful JSON support if you need to store raw gateway response payloads.
- **State Management / Caching:** **Redis**.

- *Why:* Essential for caching Daraja OAuth access tokens (which expire every hour), handling rate limiting, and managing job queues for background processing.

### Crucial Integration Blueprint: Stripe + Visa + Daraja
When designing your checkout flow, keep these architectural realities in mind:

1. **Stripe & Visa Handling:**

- Stripe natively manages global credit and debit cards (Visa, Mastercard). For compliance, use **Stripe Elements** or **Stripe Checkout** so card data goes directly to Stripe's servers, minimizing your PCI-DSS compliance scope.
2. **Safaricom Daraja API Handling:**

- **STK Push (M-Pesa Express):** When a user selects M-Pesa, your frontend collects their phone number (formatted as `2547XXXXXXXX`), and your backend calls the Daraja STK Push endpoint.
- **The Callback Architecture:** Daraja requires a publicly accessible HTTPS URL (`CallBackURL`) to report whether the user successfully put in their PIN or cancelled. **Never fulfill an order inside the immediate API response.** Always mark the order as `Pending` and wait for the asynchronous callback payload to update the order status to `Paid`.
- **Reconciliation Fallback:** Webhooks can occasionally fail due to network blips. Implement a nightly cron job or manual background worker that queries Daraja’s **Transaction Status API** to reconcile any orders stuck in a pending state.

### Alternative Shortcut: Aggregator Gateways
If maintaining two separate API integrations (Stripe for cards + Daraja for M-Pesa) feels overly complex for your timeline, consider using localized payment aggregators that bundle both capabilities into a single API and dashboard:

- **Paystack** or **Flutterwave**: Widely used across Africa, they natively support local card processing, mobile money (including M-Pesa), and offer clean developer SDKs with unified webhooks.
- *Note:* If your business targets a heavy mix of domestic East African traffic (M-Pesa) and international western buyers (Global Visa/Mastercard), pairing **Stripe** directly with a direct **Daraja API** implementation gives you lower transaction fee overhead and deeper regional customization.To manage shipping methods, pickup points, and delivery tracking across a custom stack (such as Node.js, Python, or Laravel), the architecture relies on structured relational data, background job queues, and real-time webhook listeners.

### 1. Database Schema Design (PostgreSQL / MySQL)
To track orders, flexible shipping choices, pickup locations, and real-time delivery status, design your database using relational tables:

Plaintext

```
  ┌──────────────┐          ┌─────────────────────┐          ┌───────────────────┐
  │    Orders    │─────────<│   Order_Shipments   │─────────<│ Tracking_Events   │
  └──────────────┘          └─────────────────────┘          └───────────────────┘
         │                             │
         │                             │
         ▼                             ▼
  ┌──────────────┐          ┌─────────────────────┐
  │ Pickup_Nodes │          │  Shipping_Carriers  │
  └──────────────┘          └─────────────────────┘
```

#### Core Schema Definition
SQL

```
-- Store physical pickup locations (e.g., local hubs, agent stores)
CREATE TABLE pickup_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    operating_hours JSONB, -- {"mon-fri": "08:00-18:00", "sat": "09:00-15:00"}
    is_active BOOLEAN DEFAULT TRUE
);

-- Active shipments tied to an order
CREATE TABLE order_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    fulfillment_type VARCHAR(50) NOT NULL, -- 'DOOR_DELIVERY', 'PICKUP_POINT'
    pickup_node_id UUID REFERENCES pickup_nodes(id) NULL,
    carrier_name VARCHAR(100),            -- 'Fargo Courier', 'Sendy', 'DHL', 'Internal Rider'
    tracking_number VARCHAR(100) UNIQUE,
    current_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    -- Enum values: PENDING, DISPATCHED, IN_TRANSIT, READY_FOR_PICKUP, DELIVERED, FAILED
    estimated_delivery TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timeline of delivery updates for customer tracking
CREATE TABLE tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID REFERENCES order_shipments(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    location VARCHAR(255),
    description TEXT,
    event_time TIMESTAMPTZ NOT NULL,
    raw_payload JSONB -- Backup of raw webhook response from third-party courier
);
```

### 2. Implementation Strategies

#### A. Pickup Points & Interactive Selection

- **Data Payload at Checkout:** Present pickup locations sorted by proximity or city. Return geographic coordinates (`latitude`, `longitude`) to render an interactive map component (e.g., via Leaflet.js or Google Maps API) on the frontend.
- **Selection State:** Save the `pickup_node_id` directly to the `order_shipments` table when `fulfillment_type === 'PICKUP_POINT'`.

#### B. Third-Party Courier Integration
When using external shipping platforms (such as DHL, EasyPost, ShipEngine, or local API-based parcel services):

1. **Shipment Creation:** When an order transitions to `PAID`, trigger a background worker (e.g., using Redis with BullMQ or Celery) to post order details to the courier's API.
2. **Label & Tracking Generation:** Store the returned tracking code (`tracking_number`) and label URL inside `order_shipments`.

#### C. Real-Time Delivery Status & Webhooks

1. **Webhook Endpoint:** Expose a secure, public HTTPS endpoint (`POST /api/v1/webhooks/shipping-updates`) for couriers to push live status events.
2. **Event Ingestion:** Validate incoming webhook signatures, update `order_shipments.current_status`, and append an entry to `tracking_events`.
3. **Customer Notifications:** Trigger email or SMS alerts (e.g., via Twilio or Africa's Talking) when status changes to `OUT_FOR_DELIVERY` or `READY_FOR_PICKUP`.
4. **Polling Backup:** Implement a scheduled cron job to query the courier's tracking API for any shipments missing automated status updates for over 12 hours.

### 3. Order Status Lifecycle
Plaintext

```
[ ORDER PLACED ] 
       │
       ▼
[ PROCESSING / PICKING ] 
       │
       ├──────────────────────────────────────┐
       ▼ (Door Delivery)                      ▼ (Pickup Point)
[ DISPATCHED / IN TRANSIT ]            [ DISPATCHED TO HUB ]
       │                                      │
       ▼                                      ▼
[ OUT FOR DELIVERY ]                   [ READY FOR PICKUP ]
       │                                      │ (OTP/PIN Verified)
       └──────────────────┬───────────────────┘
                          │
                          ▼
                    [ DELIVERED ]
```

Would you like a sample database migration script for setting up shipping tables?
**Yes, absolutely.** E-commerce giants like **Jumia** and **Kilimall** implement this exact architectural blueprint, scaled up to handle massive transaction volumes, multi-warehouse inventories, and tens of thousands of daily deliveries across multiple African countries.

Here is how their systems map directly to the architecture we discussed:

### 1. Payment Integration (M-Pesa + Global Cards)

- **Local Mobile Money (Daraja API Equivalent):** Mobile money is the lifeblood of East African e-commerce. Both Jumia and Kilimall integrate directly with Safaricom’s Daraja API (or enterprise payment aggregators) to trigger instant STK pushes when a customer checks out.
- **Global Cards:** For international buyers or local cardholders, they integrate with major card gateways (like Visa, Mastercard, and regional processors) alongside mobile wallets, providing a hybrid checkout modal.

### 2. Shipping, Nodes, & Pickup Stations

- **Kilimall Pickup Stations:** Kilimall relies heavily on a distributed network of local agent shops and dedicated pickup stations. During checkout, their frontend queries a geospatial database of active pickup nodes, allowing customers in neighborhoods across Nairobi, Nakuru, and other towns to choose a cheap, secure local pickup point rather than paying high door-delivery fees.
- **Jumia Logistics (J-Force & 3PL):** Jumia built an entire proprietary logistics arm (*Jumia Logistics*) which they scaled so effectively that they even opened it up to external merchants as a standalone third-party logistics (3PL) service. They manage dedicated line-haul transport between regional fulfillment centers and last-mile delivery hubs.

### 3. Order Tracking & Event-Driven Workflows
Because they handle thousands of orders per minute, they cannot rely on monolithic databases or synchronous API calls. Their backends use **event-driven architectures** (powered by message brokers like Apache Kafka or RabbitMQ) to manage order states:

1. **Warehouse Management System (WMS):** When payment is confirmed via webhook, the order drops into a picker's handheld terminal in the warehouse.
2. **Scan-in / Scan-out:** As parcels move from shelves →\rightarrow→ packing bins →\rightarrow→ dispatch trucks →\rightarrow→ regional hubs →\rightarrow→ final pickup stations, barcode scanners trigger database updates.
3. **Customer Notifications:** Automated event listeners fire real-time SMS and email updates (e.g., *"Your item has arrived at the Westlands pickup station and is ready for collection"*).

### Summary: Scale vs. Custom Build
While a startup or bespoke project starts with a streamlined custom stack (like a Node.js/Python backend paired with PostgreSQL and a few webhook endpoints), giants like Jumia and Kilimall expand that exact foundation into **distributed microservices** to handle high availability, fraud detection, automated inventory forecasting, and complex multi-vendor commission structures.

If you are building your own commercial platform using this architecture, you are following the exact same playbook they use!What you are describing is a variation of **retail arbitrage** or **dropshipping**, where a reseller uses a consumer-facing marketplace as their "supplier."

While the concept sounds clever—letting Jumia or Kilimall handle the heavy lifting of inventory, packing, and logistics while you pocket a markup—**doing this directly with Jumia or Kilimall has major practical, legal, and technical roadblocks.**

Here is a breakdown of why it is difficult to pull off with Jumia/Kilimall, and what smarter alternatives you can use instead.

### Why Direct Arbitrage from Jumia/Kilimall Fails

1. **No B2B/Dropship APIs:**
Jumia and Kilimall are retail marketplaces, not wholesale suppliers. They do not offer public supplier APIs, automated inventory feeds, or dropshipping programs. If you wanted to do this, you would either have to manually copy-paste orders every time a customer buys from you, or build brittle web scrapers to sync stock and prices—which violates their Terms of Service and will likely get your accounts banned quickly.
2. **The Packaging and Invoicing Dead Giveaway:**
When Jumia or Kilimall delivers an item, it arrives in branded Jumia/Kilimall packaging with a printed physical invoice inside showing the exact price they sell it for. If your customer bought the item from *your* website at a higher markup, they will immediately see they overpaid through a third party, destroying your brand trust.
3. **Thin Margins & Price Transparency:**
Jumia and Kilimall already operate on razor-thin margins and run constant flash sales. Because their prices are public, your end-users can easily cross-reference them. Trying to add a profitable markup on top of retail prices makes it nearly impossible to win customers.
4. **Customer Service & Returns Nightmares:**
If an item is defective, delayed, or the wrong size, your customer will hold *you* responsible. However, you are entirely at the mercy of Jumia or Kilimall's return windows and customer support policies to resolve it.

### Better Alternatives for a Lean E-Commerce Model
If you want the low-overhead benefits of dropshipping or affiliate marketing without managing warehouses or delivery trucks in East Africa, consider these proven paths:

#### 1. The Official Affiliate / KOL Model (Zero Risk)
Instead of buying the goods and reselling them, sign up for the **Jumia Kol Program (Affiliate Program)** or Kilimall’s affiliate network.

- **How it works:** You build a curated niche website (e.g., "Best Smart Home Gadgets in Kenya" or "Top Gaming Gear"). Instead of a shopping cart, your product buttons are **Affiliate Tracking Links** pointing to Jumia or Kilimall.
- **The Benefit:** When a user clicks your link and buys on Jumia, you earn a percentage commission on the sale. Jumia handles payment, shipping, customer service, and returns. You handle zero cash flow risk.

#### 2. Niche Dropshipping via Global Suppliers (AliExpress / CJ Dropshipping)
If you want a true automated e-commerce store with your own custom branding and checkout:

- **How it works:** Use platforms like Shopify, WooCommerce, or a custom Next.js storefront integrated with global dropshipping suppliers via APIs (like Spocket, CJ Dropshipping, or AliExpress).
- **The Benefit:** You sell items that aren't easily flooded in local retail shops, set your own profit margins, and use e-packet or global air shipping lines for delivery.

#### 3. Local B2B Wholesalers & Local Makers
Instead of competing with Jumia by buying *from* Jumia, source products directly from local importers in industrial areas (like Nairobi's CBD/Eastleigh/Gikomba) or local manufacturers.

- **How it works:** Negotiate wholesale prices directly with importers. When an order comes in on your site, you can either have a local courier (like Bolt Delivery, Sendy, or Fargo) pick it up from the wholesaler's warehouse and deliver it to your customer, or hold a tiny inventory buffer of high-turnover items.
Would you lean more toward setting up a curated **Affiliate/KOL discovery site** promoting these platforms, or building a standalone store with a local wholesale supply chain?which websites offer these B2B/Dropship APIs ,public supplier APIs, automated inventory feeds, or dropshipping programs.i want to focus on  Niche Dropshipping via Global Suppliers (AliExpress / CJ Dropshipping)

Focusing on **global dropshipping suppliers with robust, public APIs and automated inventory feeds** is a much more scalable and sustainable path than trying to arbitrage local marketplaces. It gives you full control over your pricing, customer data, and product branding without tying up your capital in warehouse inventory.

Here are the top platforms, APIs, and suppliers that specialize in Niche Dropshipping with full automation:

### 1. CJ Dropshipping (Comprehensive Global Fulfillment)
CJ Dropshipping is one of the most popular direct competitors to AliExpress for serious e-commerce stores because it is built from the ground up specifically for dropshippers.

- **API & Automation:** They offer a comprehensive **Open API** and developer dashboard. You can programmatically fetch products, sync real-time inventory levels, calculate shipping costs, and push orders automatically from your custom backend or store to their fulfillment centers.
- **Key Features:** Print-on-demand services, custom packaging (you can have items branded with your logo), global warehouses (including local hubs in the US/Europe to cut down shipping times), and strict quality control checks before items ship.

### 2. AliExpress (via DSers or Official APIs)
AliExpress remains a massive catalog source for niche products, but doing it manually is tedious. Modern dropshippers use integration middleware or official developer tools.

- **API & Automation:** While AliExpress has an official Open Platform API (mostly for affiliate programs and advanced sellers), most developers and store owners connect via **DSers** (the official AliExpress partner for automation). DSers provides robust backend APIs to sync stock, automate bulk order placement, and track multiple tracking numbers simultaneously.
- **Key Features:** Millions of niche products, low initial unit costs, and buyer protection programs. (Tip: When sourcing, always filter for suppliers offering *AliExpress Standard Shipping* or *Cainiao* for reliable tracking to East Africa or global destinations).

### 3. Spocket (Curated US & European Suppliers)
If your target audience includes buyers in Western markets (US, EU, UK) where fast shipping (2–5 days) is mandatory, Spocket is a premier choice.

- **API & Integration:** Spocket offers automated inventory updates and easy API/plugin integrations for custom storefronts, Shopify, and WooCommerce.
- **Key Features:** Vows high-quality vetted suppliers (majority based in the US/EU), which drastically reduces the defective-item rates and long shipping delays common with cheaper global alternatives.

### 4. SaleHoo & Worldwide Brands (Directory APIs & Wholesalers)
Instead of product-by-product dropshipping feeds, these platforms are massive, verified directories of legitimate wholesale suppliers and dropshippers.

- **How it works:** They vet suppliers so you don’t get scammed by middlemen posing as manufacturers. Many of these suppliers offer automated CSV/XML inventory feeds or API access once you are accepted into their program.

### How the Technical Architecture Works for a Custom Stack
If you are building a **custom e-commerce store** (like a Next.js/Node.js or Python stack) rather than using Shopify, implementing these global dropshipping APIs typically involves three core workflows:

1. **Product Catalog & Inventory Sync:**

- Your backend runs a cron job (e.g., via Redis/Celery) that periodically pings CJ Dropshipping's or AliExpress's API to update local product prices and stock counts so you never sell an out-of-stock item.
2. **Automated Order Fulfillment:**

- When a customer pays on your website (via Stripe or mobile money), your backend triggers an asynchronous order placement webhook to the supplier's API, passing the customer's shipping address and SKU.
3. **Tracking & Status Webhooks:**

- The supplier’s system responds with a tracking number. Your system saves this to your database and emails/texts the tracking link to your customer automatically.

##### 
What are the best high-margin product niches for global dropshipping targeted at international or regional buyers?

When choosing high-margin product niches for global or regional dropshipping, the golden rule is simple: **Look for items that solve a specific pain point, carry a high perceived value relative to their manufacturing cost, and are lightweight/compact** to keep global shipping fees manageable.

Here are the top high-margin product niches that perform exceptionally well in international and regional dropshipping markets:

### 1. Beauty, Skincare Tech & Personal Care Gadgets
Beauty and self-care is a massive, evergreen market driven heavily by social media marketing (TikTok and Instagram Reels).

- **Top Product Examples:** LED light therapy face masks, microcurrent facial toning devices, ultrasonic skin scrubbers, and cordless hair styling tools.
- **Why it works:** These items often cost $5 to $15 to source from platforms like CJ Dropshipping but command retail prices of $40 to $90 because consumers associate them with luxury, wellness, and medical-grade skincare.
- **Shipping Advantage:** Most are lightweight and packaged in sleek boxes, keeping air-freight costs low.

### 2. Specialized Pet Wellness & Smart Gear
Pet owners treat their pets like family and consistently show high willingness to spend money on their comfort, health, and entertainment.

- **Top Product Examples:** Orthopedic memory foam pet beds, automated laser toys, slow-feeder bowls, and portable paw cleaners.
- **Why it works:** This is a "recession-resistant" niche. Passionate pet owners rarely hesitate to buy items that improve their pet's health or happiness.
- **Shipping Advantage:** While some items can be bulky (like beds), suppliers on platforms like CJ Dropshipping offer vacuum-compressed shipping options to drastically reduce dimensional weight fees.

### 3. Ergonomic & Remote Work / Minimalist Desk Setup
With remote work and hybrid corporate structures remaining a permanent fixture globally, professionals are eager to optimize their home office spaces.

- **Top Product Examples:** Aluminum laptop stands, monitor light bars, cable management raceways, ergonomic wrist rests, and vertical mice.
- **Why it works:** Office workers and software professionals have high disposable income and view desk upgrades as tax-deductible or productivity-boosting investments, allowing for healthy markups.
- **Shipping Advantage:** Flat, durable, and stackable items that rarely break during transit.

### 4. Fitness & Muscle Recovery Gear
Fitness trends are global, and home-gym or travel-friendly workout gear has sustained massive popularity.

- **Top Product Examples:** Deep-tissue massage guns, smart posture correctors, compact resistance band sets, and portable protein shaker bottles.
- **Why it works:** Recovery and wellness gear solves immediate physical pain (muscle soreness, back stiffness from sitting), which triggers strong impulse-buying behavior.
- **Shipping Advantage:** Many of these are modular and light, making them cheap to ship globally.

### 5. Smart Travel & Car Gadgets
Solving minor annoyances while traveling or driving is a goldmine for viral video marketing.

- **Top Product Examples:** Compact digital tire inflators, multi-device magnetic travel chargers, anti-theft RFID passport wallets, and smart car phone mounts with wireless charging.
- **Why it works:** They are classic "problem-solving" products. When a driver sees a gadget that fixes a flat tire on the side of the road without a mechanic, conversion rates skyrocket.

### Key Rules for Selecting Your Winning Product
Before committing to a niche, run your potential product ideas through this quick filter:

1. **The 3x Markup Rule:** Can you sell it for at least 3 times what it costs you (including shipping)? (e.g., if it costs $10 delivered, you should be able to retail it for $30+ to cover marketing and profit).
2. **The "Not at the Supermarket" Test:** Avoid generic items that buyers can easily pick up at a local supermarket or hardware store. Choose items with unique features or specialized designs.
3. **Low Fragility:** Avoid overly fragile glass or complex mechanical electronics that have high return rates due to shipping damage.
Which of these niches aligns best with your personal interests or the type of audience you plan to target?






I’ll turn this into a practical shortlist, distinguishing suppliers with documented APIs from services that mainly automate through Shopify plugins, and flagging the ones that fit an international or Kenya-focused store.

For the existing custom Astro/Node store, start by evaluating CJ Dropshipping: its [official API documentation](https://developers.cjdropshipping.com/) covers product, inventory, logistics, and order workflows. It requires account access/credentials, so public docs do not mean anonymous use. [DSers](https://www.dsers.com/) is useful for AliExpress testing and supported store integrations, but do not assume it offers a general API for a custom Astro app; confirm API access before building around it. [Syncee](https://syncee.com/) and [Spocket](https://www.spocket.co/) are worth comparing for supplier feeds and store integrations, but verify whether they grant a usable custom API, and check each supplier’s shipping cost, inventory refresh, and delivery/returns to your target countries.

For a first niche, I’d test compact, non-electrical desk/work accessories. They’re easier to ship and generally avoid battery, certification, and medical-claim complications. Avoid assuming a 3× markup guarantees profit: subtract landed cost, fees, taxes/duties, refunds, and customer acquisition costs. If Kenya is your first market, compare actual delivery time and customs against local sourcing before committing.

Keep the current stack for now; sync supplier data on the backend, never expose supplier credentials in the browser, and send supplier orders only after payment is genuinely confirmed. Important: the current project does not yet have Stripe card processing, and card orders remain pending; its Safaricom/Jotform flow also still needs sandbox testing. See the project’s payment setup notes before treating it as ready for sales.


Your URI is valid for MongoDB running locally on its default port: mongodb://127.0.0.1:27017/e-commerce. The e-commerce database will be created automatically when the app first saves data.

I checked this machine: MongoDB commands are not installed, no MongoDB service is active, and nothing is listening on port 27017. So the URI is right, but it cannot connect yet. Install MongoDB Community for your Linux version using the official [MongoDB installation guide](https://www.mongodb.com/docs/manual/administration/install-community/) Then run:

```bash
sudo systemctl enable --now mongod
mongosh 'mongodb://127.0.0.1:27017/e-commerce' --eval 'db.runCommand({ ping: 1 })'
```

A successful check returns ok: 1. Keep this line in backend/.env as-is, then start the backend with npm --prefix backend start; it should report that MongoDB connected.

MongoDB Atlas uses connection strings beginning with mongodb+srv://, and this project passes MONGODB_URI directly to Mongoose, which supports that format. You do not need a local MongoDB service if you use Atlas.

In Atlas, create a database user and allow your computer’s current IP in Network Access. Avoid allowing access from everywhere for a permanent setup.
Copy the application connection string from Atlas and put it in MONGODB_URI in backend/.env. It will look like:

```bash
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/e-commerce?retryWrites=true&w=majority
```

Replace the placeholders with Atlas’s values; don’t share or commit this URI. If your password has special characters, URL-encode them.
Run npm --prefix backend start. A successful connection should let the API start. If it fails, check Atlas Network Access, the database username/password, and the URI database user credentials.
The mongod.service does not exist error only means the local MongoDB service is not installed; it does not prevent using Atlas.

That error means the backend found your Atlas cluster but could not establish a connection to its database servers. The most common cause is the Atlas IP access list.

In MongoDB Atlas, open Security → Network Access → IP Access List and add your current public IP using Add Current IP Address. Wait for the entry to become active, then retry npm --prefix backend start. Your public IP can change, so update it if the connection later stops working. Avoid 0.0.0.0/0 except perhaps for a brief, controlled diagnostic.
Make sure the Atlas cluster is running and the database user/password in backend/.env are correct. If the password contains reserved URL characters (such as @), URL-encode the password portion of the URI; do not encode the whole connection string.

If it still fails, a VPN, office/public Wi-Fi, or firewall may block outbound connections to MongoDB’s port 27017. Try another trusted network or ask the network administrator.
The selected text looks like a credential. If it is your Atlas database password, rotate it in Atlas now and update the .env file; avoid sharing passwords or connection strings. A successful backend start should report that MongoDB connected.