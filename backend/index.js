const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { randomBytes } = require("node:crypto");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");
const { hashPassword, verifyPassword } = require("./auth-utils");
const { createAdminAuth, verifyAdminCredentials } = require("./admin-auth");

const port = Number(process.env.PORT) || 4000;
const app = express();
const uploadDirectory = path.join(__dirname, "upload", "images");
fs.mkdirSync(uploadDirectory, { recursive: true });

app.use(express.json({ limit: "1mb" }));
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
const requireAdmin = createAdminAuth(jwt, jwtSecret);
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
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
    enum: ["women", "men", "kid"],
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
});


const Product = mongoose.model('Product', productSchema);

// Schema for users
const Users = mongoose.model('Users', {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
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
  currency: {
    type: String,
    default: 'USD',
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  transactionReference: {
    type: String,
  },
  items: {
    type: Object, // cartItems mapping productId -> quantity
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

// Add product endpoint
app.post("/addproduct", requireAdmin, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const { image, category } = req.body;
  const newPrice = Number(req.body.new_price);
  const oldPrice = Number(req.body.old_price);
  if (
    !name || name.length > 160 || !image
    || !["women", "men", "kid"].includes(category)
    || !Number.isFinite(newPrice) || newPrice <= 0
    || !Number.isFinite(oldPrice) || oldPrice < newPrice
  ) {
    return res.status(400).json({ success: false, message: "Enter a name, image, category, and valid prices." });
  }
  try {
    const product = await Product.create({
      id: Date.now(),
      name,
      image,
      category,
      new_price: newPrice,
      old_price: oldPrice,
    });
    res.status(201).json({ success: true, product: product.toObject() });
  } catch (error) {
    console.error("Error saving product:", error);
    res.status(500).json({ success: false, message: "Error saving product." });
  }
});


// Assuming you have already defined express, app, Product model, etc.
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



// app.listen(port, (error) => {
//   if (!error) {
//     console.log('Server is running on port ' + port);
//   } else {
//     console.log('ERROR#################: '+error);
//   }
// });