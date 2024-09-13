const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const exp = require("constants");

const port = 4000;
const app = express();

app.use(express.json());
app.use(cors());


mongoose.connect("mongodb+srv://crimsonsummer81:hWdJEVhkVNrwOLoQ@cluster0.9h2mp.mongodb.net/")


// Example route
app.get("/", (req, res) => {
  res.send("Hello, world! and Express app is running");
});


// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, './upload/images');
    },
    filename: (req, file, cb) => {
      cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
  });

  
// Create upload instance
const upload = multer({ storage: storage });


app.use('/images', express.static('upload/images'))

// Create Upload Endpoint for images
app.post("/upload", upload.single('product'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: 0, message: "No file uploaded." });
    }
  
    res.json({
      success: 1,
      image_url: `http://localhost:${port}/images/${req.file.filename}`
    });
  });
  
// Start server
app.listen(port, (error) => {
    if (!error){
    console.log(`Server is running on port ${port}`);
    }
    else{
    console.log(`Error : ` + error);

    }
  });
  

