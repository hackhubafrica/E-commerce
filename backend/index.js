const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");

const port = 4000;
const app = express();

app.use(express.json());
app.use(cors());

// MongoDB connection (using IPv4)
const uri = 'mongodb://127.0.0.1:30000/e-commerce';

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
  console.log("POST request to /signup with data:", req.body);

  try {
    const check = await Users.findOne({ email: req.body.email });
    if (check) {
      console.error("User already exists:", req.body.email);
      return res.status(400).json({ success: false, errors: "User already exists" });
    }

    const cart = {};
    for (let i = 0; i < 300; i++) {
      cart[i] = 0;
    }

    const user = new Users({
      name: req.body.username,
      email: req.body.email,
      password: req.body.password,
      cartData: cart,
    });

    await user.save();
    console.log("User signed up successfully:", user.email);

    const data = {
      user: {
        id: user._id,
      },
    };

    const token = jwt.sign(data, 'secret_ecom');
    res.json({ success: true, token });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).send("Server Error");
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  console.log("POST request to /login with data:", req.body);

  try {
    const user = await Users.findOne({ email: req.body.email });
    if (user) {
      const passCompare = req.body.password === user.password;
      if (passCompare) {
        const data = {
          user: {
            id: user._id,
          },
        };
        const token = jwt.sign(data, 'secret_ecom');
        console.log("User logged in successfully:", user.email);
        res.json({ success: true, token });
      } else {
        console.error("Incorrect password for user:", req.body.email);
        res.json({ success: false, errors: "Incorrect password" });
      }
    } else {
      console.error("User not found:", req.body.email);
      res.json({ success: false, errors: "User not found" });
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send("Server Error");
  }
});



// app.listen(port, (error) => {
//   if (!error) {
//     console.log('Server is running on port ' + port);
//   } else {
//     console.log('ERROR#################: '+error);
//   }
// });