// import Express ( web framework for Node.js )

const express = require("express");

// import CORS ( Cross-Origin Resource Sharing )

const cors = require("cors");

// create an instance of Express
const app = express();

// Midleware

// Enable CORS for all routes
// This allows your React app runing on 5173
// to communicate with this backend server running on port 5000
app.use(cors());

// Allows server to understand JSON data sent from frontend
app.use(express.json());

// Define a simple route for testing
app.get("/", (req, res) => {
  res.send("Hello from the backend server!");
});

// Start the server on port 5000
app.listen(5000, ()=>{
    console.log("Server is running on port 5000");  
})