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

// MongoDB connection (ensure MongoDB is running and replace with your connection string if needed)
mongoose.connect("mongodb://localhost:30000/e-commerce")

// console.log(mongoose.Collection())
// Example route
app.get("/", (req, res) => {
  res.send("Hello, world! Express app is running");
});


// Image storage engine
const storage  = multer.diskStorage({
  destination: './upload/images',
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  }
})

const upload = multer({ storage: storage });

// // Configure multer storage
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, './upload/images');
//   },
//   filename: (req, file, cb) => {
//     cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
//   }
// });

// Create multer upload instance
// const upload = multer({ storage: storage });

app.use('/images', express.static('upload/images'));

// Create Upload Endpoint for images
app.post("/upload", upload.single('image'), (req, res) => {
  
  if (!req.file) {
    return res.status(400).json({ success: 0, message: "No file uploaded." });
  }

  res.json({
    success: 1,
    image_url: `http://localhost:${port}/images/${req.file.filename}`
  });
});



// Schema for uploading products
const Product = mongoose.model("Product", {
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
  try {
    const product = new Product({
      id: req.body.id,
      name: req.body.name,
      image: req.body.image,
      category: req.body.category,
      new_price: req.body.new_price,
      old_price: req.body.old_price,
    });

    console.log(product);
    await product.save();
    console.log("Product Saved");
    res.json({
      success: true,
      name: req.body.name,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

// Delete product endpoint
app.post('/removeproduct', async (req, res) => {
  try {
    await Product.findOneAndDelete({ id: req.body.id });
    console.log("Product Removed");
    res.json({
      success: true,
      message: "Product removed successfully"
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

// Get all products endpoint
app.get('/allproducts', async (req, res) => {
  try {
    const products = await Product.find({});
    console.log("All Products Fetched");
    res.json(products);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

// Signup endpoint
app.post('/signup', async (req, res) => {
  try {
    const check = await Users.findOne({ email: req.body.email });
    if (check) {
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

    const data = {
      user: {
        id: user._id,
      },
    };

    const token = jwt.sign(data, 'secret_ecom');
    res.json({ success: true, token });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
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
        res.json({ success: true, token });
      } else {
        res.json({ success: false, errors: "Incorrect password" });
      }
    } else {
      res.json({ success: false, errors: "User not found" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

// Start server
app.listen(port, (error) => {
  if (!error) {
    console.log('Server is running on port ' + port);
  } else {
    console.log('ERROR#################: '+error);
  }
});
