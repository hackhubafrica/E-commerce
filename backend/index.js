const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { randomBytes } = require("node:crypto");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");
const Stripe = require("stripe");
const firebaseAdmin = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth");
const { hashPassword, verifyPassword } = require("./auth-utils");
const { createAdminAuth, verifyAdminCredentials } = require("./admin-auth");
const { createStripeCheckoutHandlers } = require("./stripe-checkout");
const { createStablecoinCheckoutHandlers } = require("./stablecoin-checkout");
const { createCJClient } = require("./cj-catalog");
const { createFirebaseLoginHandler } = require("./firebase-auth");

const port = Number(process.env.PORT) || 4000;
const app = express();
const uploadDirectory = path.join(__dirname, "upload", "images");
fs.mkdirSync(uploadDirectory, { recursive: true });

app.use(express.json({
  limit: "1mb",
  verify(req, res, buffer) {
    if (req.originalUrl.startsWith("/api/payments/stripe/webhook") || req.originalUrl.startsWith("/api/payments/stablecoin/webhook")) {
      req.rawBody = Buffer.from(buffer);
    }
  },
}));
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:4321")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin is not allowed by CORS."));
    },
  })
);

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/e-commerce";
const jwtSecret = process.env.JWT_SECRET;
let firebaseAuth = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  try {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"),
    );
    if (!firebaseAdmin.getApps().length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.cert(serviceAccount),
      });
    }
    firebaseAuth = getAuth(firebaseAdmin.getApp());
  } catch (error) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_BASE64 is invalid: ${error.message}`);
  }
}
const requireAdmin = createAdminAuth(jwt, jwtSecret);
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: "Too many sign-in attempts. Try again later." },
});
const providerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: "Too many sign-in attempts. Try again later." },
});
const customerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: "Too many sign-in attempts. Try again later." },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: "Too many sign-up attempts. Try again later." },
});
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: "Too many checkout attempts. Try again later." },
});
const orderLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: "Too many order lookup attempts. Try again later." },
});

mongoose.connect(uri)
  .then(() => {
    console.log('MongoDB connected successfully!');
    app.listen(port, (error) => {
      if (!error) {
        console.log('Server is running on port ' + port);
      } else {
        console.error('Error starting server: ', error);
      }
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

// Example route
app.get("/", (req, res) => {
  console.log("GET request to /");
  res.send("Hello, world! Express app is running");
});


// Configure multer to store files in the desired directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    const extensions = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
    const uniqueSuffix = `${Date.now()}-${randomBytes(8).toString("hex")}`;
    cb(null, `${uniqueSuffix}${extensions[file.mimetype]}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    cb(null, ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype));
  },
});

// Serve static files from 'upload/images'
app.use('/images', express.static(uploadDirectory));

app.post("/admin/login", adminLoginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !jwtSecret) {
    return res.status(503).json({ success: false, error: "Admin login is not configured." });
  }
  if (!verifyAdminCredentials(email, password, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ success: false, error: "Email or password is incorrect." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const token = jwt.sign({ role: "admin", email: normalizedEmail }, jwtSecret, { expiresIn: "8h" });
  return res.json({ success: true, token });
});

app.get("/admin/session", requireAdmin, (req, res) => {
  res.json({ success: true, email: req.admin.email });
});

app.post("/upload", requireAdmin, upload.single("product"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Choose an image (JPEG, PNG, WebP, or GIF, up to 5 MB)." });
  }
  const baseUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
  res.json({ success: true, image_url: `${baseUrl}/images/${req.file.filename}` });
});

// Schema for uploading products
// const Product = mongoose.model("Product", {

const productSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ["women", "men", "kid", "office", "home", "pets", "beauty", "travel", "fitness"],
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
  supplier: {
    type: String,
    enum: ["manual", "cj"],
    default: "manual",
  },
  supplierProductId: String,
  supplierVariantId: String,
  supplierVariantSku: String,
  supplierSku: String,
  supplierCost: Number,
});

productSchema.index({ supplierProductId: 1 }, { unique: true, sparse: true });

const Product = mongoose.model('Product', productSchema);

// Schema for users
const Users = mongoose.model('Users', {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
  },
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now,
  }
});

// Schema for orders (Jotform webhook submissions)
const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
  },
  customerName: {
    type: String,
  },
  customerEmail: {
    type: String,
  },
  customerPhone: {
    type: String,
  },
  customerAddress: {
    type: String,
  },
  paymentMethod: {
    type: String,
    enum: ['Credit Card (International)', 'Local Payment / Bank Transfer', 'M-Pesa STK Push'],
    required: true,
  },
  orderTotal: {
    type: Number,
    required: true,
  },
  productSubtotal: Number,
  shippingAmount: Number,
  currency: {
    type: String,
    default: 'USD',
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  paymentProvider: {
    type: String,
    enum: ["stripe", "jotform", "daraja"],
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending",
  },
  fulfillmentStatus: {
    type: String,
    enum: ["awaiting_payment", "awaiting_supplier_review", "submitted", "fulfilled", "not_submitted"],
    default: "awaiting_payment",
  },
  stripeCheckoutSessionId: String,
  paymentIntentId: String,
  transactionReference: {
    type: String,
  },
  items: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  submissionId: {
    type: String, // Jotform submission ID
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Order = mongoose.model('Order', orderSchema);

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const stripeHandlers = createStripeCheckoutHandlers({
  stripe,
  Product,
  Order,
  config: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    allowedShippingCountries: process.env.STRIPE_ALLOWED_SHIPPING_COUNTRIES,
    shippingAmountCents: process.env.STRIPE_SHIPPING_AMOUNT_CENTS,
    shippingLabel: process.env.STRIPE_SHIPPING_LABEL,
    storefrontUrl: process.env.PUBLIC_STOREFRONT_URL,
  },
  checkSupplierAvailability: async (items, countryCode) => {
    const checkedProducts = new Map();
    for (const item of items.filter((cartItem) => cartItem.supplier === "cj")) {
      if (!checkedProducts.has(item.supplierProductId)) {
        const variants = await cjClient.getProductVariants(item.supplierProductId, countryCode);
        checkedProducts.set(item.supplierProductId, variants);
      }
      const variant = checkedProducts.get(item.supplierProductId)
        .find((candidate) => candidate.id === item.supplierVariantId);
      if (!variant || variant.inventory < item.quantity) {
        throw new Error(`${item.name} is not currently available in the selected country.`);
      }
      if (variant.cost > item.unitAmount / 100) {
        throw new Error(`${item.name} supplier price has increased. The store must review its retail price.`);
      }
    }
  },
});
const cjClient = createCJClient({ apiKey: process.env.CJ_API_KEY });

const stablecoinHandlers = createStablecoinCheckoutHandlers({
  Product,
  Order,
  config: {
    provider: process.env.STABLECOIN_PROVIDER || "coinbase",
    apiKey: process.env.STABLECOIN_API_KEY,
    webhookSecret: process.env.STABLECOIN_WEBHOOK_SECRET,
    defaultCurrency: process.env.STABLECOIN_DEFAULT_CURRENCY || "USDC",
    defaultNetwork: process.env.STABLECOIN_DEFAULT_NETWORK || "ethereum",
    usdToLocalRate: process.env.STABLECOIN_USD_TO_LOCAL_RATE,
    storefrontUrl: process.env.PUBLIC_STOREFRONT_URL,
    allowedShippingCountries: process.env.STRIPE_ALLOWED_SHIPPING_COUNTRIES,
    shippingAmountCents: process.env.STRIPE_SHIPPING_AMOUNT_CENTS,
    shippingLabel: process.env.STRIPE_SHIPPING_LABEL,
  },
  checkSupplierAvailability: async (items, countryCode) => {
    const checkedProducts = new Map();
    for (const item of items.filter((cartItem) => cartItem.supplier === "cj")) {
      if (!checkedProducts.has(item.supplierProductId)) {
        const variants = await cjClient.getProductVariants(item.supplierProductId, countryCode);
        checkedProducts.set(item.supplierProductId, variants);
      }
      const variant = checkedProducts.get(item.supplierProductId)
        .find((candidate) => candidate.id === item.supplierVariantId);
      if (!variant || variant.inventory < item.quantity) {
        throw new Error(`${item.name} is not currently available in the selected country.`);
      }
      if (variant.cost > item.unitAmount / 100) {
        throw new Error(`${item.name} supplier price has increased. The store must review its retail price.`);
      }
    }
  },
});

app.post("/api/checkout/stripe", checkoutLimiter, stripeHandlers.createCheckout);
app.post("/api/payments/stripe/webhook", stripeHandlers.stripeWebhook);
app.post("/api/checkout/stablecoin", checkoutLimiter, stablecoinHandlers.createCheckout);
app.post("/api/payments/stablecoin/webhook", stablecoinHandlers.stablecoinWebhook);

app.get("/admin/cj/products", requireAdmin, async (req, res) => {
  try {
    const products = await cjClient.searchProducts(req.query.q);
    return res.json({ success: true, products });
  } catch (error) {
    const status = error.message.includes("search term") ? 400 : 502;
    return res.status(status).json({ success: false, error: error.message });
  }
});

app.get("/admin/cj/products/:productId/variants", requireAdmin, async (req, res) => {
  try {
    const variants = await cjClient.getProductVariants(req.params.productId, req.query.countryCode);
    return res.json({ success: true, variants });
  } catch (error) {
    const status = error.message.includes("Choose a valid") ? 400 : 502;
    return res.status(status).json({ success: false, error: error.message });
  }
});

app.post("/admin/cj/import", requireAdmin, async (req, res) => {
  const supplierProductId = String(req.body.supplierProductId || "").trim();
  const supplierVariantId = String(req.body.supplierVariantId || "").trim();
  const retailPrice = Number(req.body.new_price);
  const category = String(req.body.category || "");
  if (!supplierProductId || !supplierVariantId || !Number.isFinite(retailPrice) || retailPrice <= 0
    || !["women", "men", "kid", "office", "home", "pets", "beauty", "travel", "fitness"].includes(category)) {
    return res.status(400).json({ success: false, error: "Select a valid product, category, and retail price." });
  }

  try {
    const source = cjClient.getCachedProduct(supplierProductId);
    if (!source) {
      return res.status(404).json({ success: false, error: "Search for that CJ item again before importing it." });
    }
    const variant = cjClient.getCachedVariant(supplierProductId, supplierVariantId);
    if (!variant) {
      return res.status(404).json({ success: false, error: "Load this product's variants again before importing it." });
    }
    if (variant.inventory < 1) {
      return res.status(409).json({ success: false, error: "CJ currently reports no inventory for this variant." });
    }
    const alreadyImported = await Product.findOne({ supplierProductId }).lean();
    if (alreadyImported) {
      return res.status(409).json({ success: false, error: "This CJ product is already in your catalog." });
    }
    const product = await Product.create({
      id: Date.now(),
      name: source.name,
      image: source.image,
      category,
      new_price: retailPrice,
      old_price: retailPrice,
      supplier: "cj",
      supplierProductId: source.id,
      supplierVariantId: variant.id,
      supplierVariantSku: variant.sku,
      supplierSku: source.sku,
      supplierCost: variant.cost,
    });
    return res.status(201).json({ success: true, product: product.toObject() });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: "This CJ product is already in your catalog." });
    }
    console.error("Could not import product from CJ:", error);
    return res.status(502).json({ success: false, error: "CJ product import failed. Check the supplier API configuration." });
  }
});

app.get("/admin/orders/paid", requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find({
      paymentStatus: "paid",
      fulfillmentStatus: "awaiting_supplier_review",
    })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();
    return res.json({
      success: true,
      orders: orders.map((order) => ({
        orderId: order.orderId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        orderTotal: order.orderTotal,
        productSubtotal: order.productSubtotal,
        shippingAmount: order.shippingAmount,
        currency: order.currency,
        items: order.items,
        createdAt: order.createdAt,
      })),
    });
  } catch (error) {
    console.error("Could not retrieve paid orders for review:", error);
    return res.status(500).json({ success: false, error: "Unable to load paid orders." });
  }
});

// Add product endpoint
app.post("/addproduct", requireAdmin, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const { image, category } = req.body;
  const newPrice = Number(req.body.new_price);
  const oldPrice = Number(req.body.old_price);
  const errors = [];

  if (!name) errors.push("name is required.");
  else if (name.length > 160) errors.push("name cannot exceed 160 characters.");
  if (!image) errors.push("image is required.");
  if (!category || !["women", "men", "kid", "office", "home", "pets", "beauty", "travel", "fitness"].includes(category)) {
    errors.push("category must be one of: women, men, kid, office, home, pets, beauty, travel, fitness.");
  }
  if (!Number.isFinite(newPrice) || newPrice <= 0) errors.push("new price must be a positive number.");
  if (!Number.isFinite(oldPrice) || oldPrice < newPrice) errors.push("old price must be a number greater than or equal to the new price.");

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: "Validation failed.", errors });
  }

  try {
    const product = await Product.create({
      name,
      image,
      category,
      new_price: newPrice,
      old_price: oldPrice,
    });
    res.status(201).json({ success: true, product: { ...product.toObject(), id: String(product._id) } });
  } catch (error) {
    console.error("Error saving product:", error);
    res.status(500).json({ success: false, message: "Error saving product." });
  }
});

// Get a single product (for editing)
app.get("/addproduct/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }
    const product = await Product.findById(id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
    return res.json({ success: true, product: { ...product, id: String(product._id) } });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ success: false, message: "Error fetching product." });
  }
});

// Update a product (full replacement)
app.put("/addproduct/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }
    const name = String(req.body.name || "").trim();
    const { image, category, available } = req.body;
    const newPrice = Number(req.body.new_price);
    const oldPrice = Number(req.body.old_price);
    if (
      !name || name.length > 160 || !image
      || !["women", "men", "kid", "office", "home", "pets", "beauty", "travel", "fitness"].includes(category)
      || !Number.isFinite(newPrice) || newPrice <= 0
      || !Number.isFinite(oldPrice) || oldPrice < newPrice
    ) {
      return res.status(400).json({ success: false, message: "Enter a name, image, category, and valid prices." });
    }
    const product = await Product.findByIdAndUpdate(
      id,
      { name, image, category, new_price: newPrice, old_price: oldPrice, available: available !== false },
      { new: true, runValidators: true }
    ).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
    return res.json({ success: true, product: { ...product, id: String(product._id) } });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ success: false, message: "Error updating product." });
  }
});

// Partial update a product (e.g. toggle availability)
app.patch("/addproduct/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }
    const updates = {};
    if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body.image !== undefined) updates.image = req.body.image;
    if (req.body.category !== undefined) updates.category = req.body.category;
    if (req.body.new_price !== undefined) updates.new_price = Number(req.body.new_price);
    if (req.body.old_price !== undefined) updates.old_price = Number(req.body.old_price);
    if (req.body.available !== undefined) updates.available = req.body.available === true || req.body.available === "true";

    const product = await Product.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
    return res.json({ success: true, product: { ...product, id: String(product._id) } });
  } catch (error) {
    console.error("Error patching product:", error);
    res.status(500).json({ success: false, message: "Error updating product." });
  }
});

// Remove a product
app.post("/removeproduct", requireAdmin, async (req, res) => {
  try {
    const id = String(req.body.id || "");
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    res.json({ success: true, message: "Product removed successfully." });
  } catch (error) {
    console.error("Error removing product:", error);
    res.status(500).json({ success: 0, message: "Internal server error." });
  }
});


// Get all products endpoint
app.get("/allproducts", async (req, res) => {
  try {
    const products = await Product.find({ available: { $ne: false } }).sort({ date: -1 }).lean();
    res.json(products.map((product) => ({
      ...product,
      id: String(product._id),
      category: String(product.category || "").toLowerCase(),
    })));
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Server Error");
  }
});

app.get("/api/shipping/countries", (req, res) => {
  const countries = String(process.env.STRIPE_ALLOWED_SHIPPING_COUNTRIES || "")
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter((country) => /^[A-Z]{2}$/.test(country));
  return res.json({ success: true, countries: [...new Set(countries)] });
});

app.get("/api/orders/:orderId", orderLookupLimiter, async (req, res) => {
  const orderId = String(req.params.orderId || "").trim();
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!orderId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: "Enter the order reference and checkout email." });
  }
  try {
    const order = await Order.findOne({ orderId, customerEmail: email }).lean();
    if (!order) {
      return res.status(404).json({ success: false, error: "Order reference or email was not recognized." });
    }
    return res.json({
      success: true,
      order: {
        order_id: order.orderId,
        status: order.status,
        order_total: order.orderTotal,
        product_subtotal: order.productSubtotal,
        shipping_amount: order.shippingAmount,
        currency: order.currency,
        delivery_status: order.fulfillmentStatus || "pending",
        pickup_station: null,
        payment_provider: order.paymentProvider,
      },
    });
  } catch (error) {
    console.error("Could not retrieve order status:", error);
    return res.status(500).json({ success: false, error: "Unable to look up this order right now." });
  }
});

// Signup endpoint
app.post('/signup', signupLimiter, async (req, res) => {
  try {
    const name = String(req.body.name || req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;
    if (!name || !email || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        errors: "Name, email, and a password of at least 8 characters are required.",
      });
    }
    if (!jwtSecret) {
      console.error("JWT_SECRET is not configured.");
      return res.status(503).json({
        success: false,
        errors: "Account service is not configured. Please contact the store.",
      });
    }

    const check = await Users.findOne({ email });
    if (check) {
      return res.status(409).json({ success: false, errors: "An account with this email already exists." });
    }

    const cart = {};
    for (let i = 0; i < 300; i++) {
      cart[i] = 0;
    }

    const user = new Users({
      name,
      email,
      password: await hashPassword(password),
      cartData: cart,
    });

    await user.save();
    console.log("User signed up successfully:", user.email);

    const data = {
      user: {
        id: user._id,
      },
    };

    const token = jwt.sign(data, jwtSecret, { expiresIn: "7d" });
    res.json({ success: true, token });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).send("Server Error");
  }
});

// Jotform webhook endpoint — receives Master Form submissions
app.post('/api/order', async (req, res) => {
  try {
    console.log('Jotform webhook received.');

    // Jotform webhook payload structure:
    // req.body may contain raw submission data. Fields are typically
    // accessible directly or inside a 'rawRequest' / 'submission' object.
    const payload = req.body.rawRequest ? JSON.parse(req.body.rawRequest) : req.body;

    // Extract fields from Jotform submission
    // Adjust field names (q1, q2, etc.) to match your actual Jotform field IDs
    const orderId = payload.orderId || payload.q1 || payload.order_id || '';
    const customerName = payload.name || payload.q2 || '';
    const customerEmail = payload.email || payload.q3 || '';
    const customerPhone = payload.phone || payload.q4 || '';
    const customerAddress = payload.address || payload.q5 || '';
    const paymentMethod = payload['Select Payment Method'] || payload.paymentMethod || 'Local Payment / Bank Transfer';
    const orderTotal = Number(payload.orderTotal || payload.q6 || payload.amount || 0);
    const transactionReference = payload.transactionReference || payload.q7 || '';
    const submissionId = payload.submissionID || payload.submission_id || '';

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Missing orderId' });
    }

    // Build items object from cart if available
    const items = payload.items || {};

    const order = new Order({
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      paymentMethod,
      orderTotal,
      status: 'pending',
      transactionReference,
      items,
      submissionId,
    });

    await order.save();
    console.log('Order saved to MongoDB:', orderId);

    return res.status(200).json({
      success: true,
      message: 'Order received',
      orderId: orderId,
    });
  } catch (error) {
    console.error('Jotform webhook error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Login endpoint
app.post('/login', customerLoginLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;
    if (!email || typeof password !== "string" || !password) {
      return res.status(400).json({
        success: false,
        errors: "Enter your email and password.",
      });
    }
    if (!jwtSecret) {
      console.error("JWT_SECRET is not configured.");
      return res.status(503).json({
        success: false,
        errors: "Account service is not configured. Please contact the store.",
      });
    }

    const user = await Users.findOne({ email });
    const passwordResult = user
      ? await verifyPassword(password, user.password)
      : { valid: false, needsUpgrade: false };
    if (!passwordResult.valid) {
      return res.status(401).json({
        success: false,
        errors: "Email or password is incorrect.",
      });
    }

    if (passwordResult.needsUpgrade) {
      user.password = await hashPassword(password);
      await user.save();
    }

    const token = jwt.sign({ user: { id: user._id } }, jwtSecret, {
      expiresIn: "7d",
    });
    return res.json({ success: true, token });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, errors: "Unable to log in right now." });
  }
});

app.post(
  "/auth/firebase",
  providerLoginLimiter,
  createFirebaseLoginHandler({ firebaseAuth, Users, jwt, jwtSecret }),
);

// ── User profile endpoints (Firebase/JWT authentication) ────────────────

app.get(
  "/api/user/me",
  createAdminAuth(jwt, jwtSecret),
  async (req, res) => {
    try {
      const user = await Users.findById(req.admin.userId || req.admin._id).lean();
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found." });
      }
      const { password, ...safeUser } = user.toObject();
      res.json({ success: true, user: safeUser });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ success: false, error: "Unable to fetch profile." });
    }
  }
);
// ── Forgot Password Endpoint ────────────────────────────────────────

app.post(
  "/api/user/forgot-password",
  async (req, res) => {
    try {
      const email = req.body.email;
      if (!email) {
        return res.status(400).json({ success: false, error: "Email is required." });
      }

      if (!firebaseAuth) {
        return res.status(503).json({ success: false, error: "Auth service not configured." });
      }

      await firebaseAuth.sendPasswordResetEmail(email);
      res.json({ success: true, message: "Password reset email sent." });
    } catch (error) {
      console.error("Forgot password error:", error);
      if (error.code === "auth/user-not-found") {
        return res.status(404).json({ success: false, error: "User with this email not found." });
      }
      res.status(500).json({ success: false, error: "Unable to send reset email." });
    }
  }
);


app.patch(
  "/api/user/me",
  createAdminAuth(jwt, jwtSecret),
  async (req, res) => {
    try {
      const updates = {};
      if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
      if (req.body.email !== undefined) updates.email = String(req.body.email).trim().toLowerCase();
      if (req.body.phone !== undefined) updates.phone = String(req.body.phone).trim();

      const allowedUpdates = ["name", "email", "phone"];
      for (const key of allowedUpdates) {
        if (req.body[key] !== undefined && !allowedUpdates.includes(key)) {
          return res.status(400).json({ success: false, error: `Cannot update field: ${key}` });
        }
      }

      const user = await Users.findByIdAndUpdate(req.admin.userId || req.admin._id, updates, { new: true, runValidators: true }).lean();
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found." });
      }

      const { password, ...safeUser } = user;
      res.json({ success: true, user: safeUser });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ success: false, error: "Unable to update profile." });
    }
  }
);

app.delete(
  "/api/user/me",
  createAdminAuth(jwt, jwtSecret),
  async (req, res) => {
    try {
      const user = await Users.findByIdAndDelete(req.admin.userId || req.admin._id);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found." });
      }
      res.json({ success: true, message: "Account deleted." });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ success: false, error: "Unable to delete account." });
    }
  }
);





// app.listen(port, (error) => {
//   if (!error) {
//     console.log('Server is running on port ' + port);
//   } else {
//     console.log('ERROR#################: '+error);
//   }
// });