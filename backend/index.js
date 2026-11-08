const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { hashPassword, verifyPassword } = require("./auth-utils");

const port = Number(process.env.PORT) || 4000;
const app = express();

app.use(express.json());
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
    cb(null, 'upload/images'); // specify the folder where you want to save files
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); // unique file name
  }
});

// Initialize multer with the defined storage
const upload = multer({ storage });

// Serve static files from 'upload/images'
app.use('/images', express.static('upload/images'));

// Upload route
app.post("/upload", upload.single('product'), (req, res) => {
  console.log("POST request to /upload");

  if (!req.file) {
    console.error("No file uploaded.");
    return res.status(400).json({ success: 0, message: "No file uploaded." });
  }

  console.log("File uploaded successfully:", req.file.filename);
  res.json({
    success: 1,
    image_url: `http://localhost:${port}/images/${req.file.filename}`
  });
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
    enum: ['Credit Card (International)', 'Local Payment / Bank Transfer'],
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
app.post('/addproduct', async (req, res) => {
  console.log("POST request to /addproduct with data:", req.body);
  
  const { name, image, category, new_price, old_price } = req.body;

  // Validate product data
  if (!name || !image || !category || !new_price) {
    return res.status(400).json({ success: 0, message: "All fields are required." });
  }

  // Generate a unique ID
  const productId = new Date().getTime().toString(); // Example of generating an ID

  const product = new Product({
    id: productId,
    name: req.body.name,
    image: req.body.image,
    category:req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price,
  });

  try {
    await product.save();
    console.log("Product saved successfully:", product);
    res.json({
      success: true,
      name: req.body.name,
    });
  } catch (error) {
    console.error("Error saving product:", error);
    res.status(500).json({ success: false, message: "Error saving product." });
  }
});


// Assuming you have already defined express, app, Product model, etc.
app.post("/removeproduct", async (req, res) => {
  try {
    const { id } = req.body;

    // Validate if the provided ID is a valid ObjectId
    if (!mongoose.isValidObjectId(id))  {
      return res.status(400).json({ success: 0, message: "Invalid product ID format." });
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ success: 0, message: "Product not found." });
    }

    res.json({ success: 1, message: "Product removed successfully." });
  } catch (error) {
    console.error("Error removing product:", error);
    res.status(500).json({ success: 0, message: "Internal server error." });
  }
});


// Get all products endpoint
app.get('/allproducts', async (req, res) => {
  console.log("GET request to /allproducts");

  try {
    let products = await Product.find({});
    console.log("All Products Fetched:", products);
    res.send(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Server Error");
  }
});

// Signup endpoint
app.post('/signup', async (req, res) => {
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
      status: paymentMethod === 'Credit Card (International)' ? 'completed' : 'pending',
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
app.post('/login', async (req, res) => {
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