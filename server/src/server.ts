import "dotenv/config"; // Automatically loads .env
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import NeDB from "nedb";  // Import NeDB for local in-memory DB

// Starting server message
console.log('\x1b[32m%s\x1b[0m', '🚀 Starting server...');

// Check if MONGO_URI is defined
if (!process.env.MONGO_URI) {
  console.error('\x1b[31m%s\x1b[0m', `❌ MongoDB URI is not defined in the environment variables: ${process.env.MONGO_URI}`);
  console.error('\x1b[33m%s\x1b[0m', 'Please set the MONGO_URI variable in your .env file.');
  process.exit(1);
} else {
  console.log('\x1b[32m%s\x1b[0m', '✅ MongoDB URI is defined in the environment variables');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Example route
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// POST route to handle user registration (/api/auth/register)
app.post("/api/auth/register", (req, res) => {
  const { username, password } = req.body;
  // Here you would typically save the user to the database
  res.status(201).json({ message: "User registered successfully", user: { username } });
});

// POST route to handle user login (/api/auth/login)
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  // Here you would typically check the user credentials
  res.status(200).json({ message: "User logged in successfully", user: { username } });
});

// POST route to handle user logout (/api/auth/logout)
app.post("/api/auth/logout", (req, res) => {
  // Here you would typically handle user logout
  res.status(200).json({ message: "User logged out successfully" });
});


// Fallback to NeDB if MongoDB connection fails
let localDb: NeDB;

const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('\x1b[32m%s\x1b[0m', '✅ Connected to MongoDB');
  } catch (err: any) {
    console.error('\x1b[31m%s\x1b[0m', `❌ MongoDB connection error: \x1b[35m${err.message || err}\x1b[0m`);
    console.log('\x1b[33m%s\x1b[0m', '⚠️ Falling back to local in-memory database (NeDB)...');
    // Use NeDB as a local fallback
    localDb = new NeDB({
      filename: './data/temp.db', // Optional: specify a file-based DB, or leave empty for in-memory
      autoload: true
    });
    console.log('\x1b[32m%s\x1b[0m', '✅ Local in-memory database (NeDB) is ready');
  }
};

// Example of using `localDb` for data operations
app.get("/data", async (req, res) => {
  if (localDb) {
    localDb.find({}, (err: Error | null, docs: any[]) => {
      if (err) {
        res.status(500).send('Error retrieving data from local DB');
      } else {
        res.json(docs);
      }
    });
  } else {
    res.status(500).send('Database not initialized');
  }
});

// Connect to MongoDB and start the server
connectToDatabase().then(() => {
  app.listen(PORT, () => {
    console.log('\x1b[34m%s\x1b[0m', `🚀 Server listening on http://localhost:${PORT}`);
  });
});

// Graceful shutdown on process termination
process.on("SIGINT", async () => {
  console.log("\nGracefully shutting down...");
  try {
    await mongoose.connection.close();  // Close the connection gracefully (if using MongoDB)
    console.log('\x1b[32m%s\x1b[0m', '✅ MongoDB connection closed');
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', `❌ Error closing MongoDB connection: \x1b[35m${err}\x1b[0m`);
  }

  process.exit(0);  // Exit after successful shutdown
});
