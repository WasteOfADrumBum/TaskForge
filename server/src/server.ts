import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

console.log('\x1b[32m%s\x1b[0m', '🚀 Starting server...');

if (!process.env.MONGO_URI) {
  console.error(
    '\x1b[31m%s\x1b[0m',
    '❌ MongoDB URI is not defined in the environment variables.',
  );
  console.error(
    '\x1b[33m%s\x1b[0m',
    'Please set the MONGO_URI variable in your .env file.',
  );
  process.exit(1);
}

console.log(
  '\x1b[32m%s\x1b[0m',
  '✅ MongoDB URI is defined in the environment variables',
);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running!");
});

app.post("/api/auth/register", (req, res) => {
  const { username } = req.body;

  res.status(201).json({
    message: "User registered successfully",
    user: { username },
  });
});

app.post("/api/auth/login", (req, res) => {
  const { username } = req.body;

  res.status(200).json({
    message: "User logged in successfully",
    user: { username },
  });
});

app.post("/api/auth/logout", (req, res) => {
  res.status(200).json({ message: "User logged out successfully" });
});

const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('\x1b[32m%s\x1b[0m', '✅ Connected to MongoDB');
  } catch (err: any) {
    console.error(
      '\x1b[31m%s\x1b[0m',
      `❌ MongoDB connection error: \x1b[35m${err.message || err}\x1b[0m`,
    );
    throw err;
  }
};

connectToDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        '\x1b[34m%s\x1b[0m',
        `🚀 Server listening on http://localhost:${PORT}`,
      );
    });
  })
  .catch(() => {
    console.error('\x1b[31m%s\x1b[0m', '❌ Server startup aborted.');
    process.exit(1);
  });

process.on("SIGINT", async () => {
  console.log("\nGracefully shutting down...");

  try {
    await mongoose.connection.close();
    console.log('\x1b[32m%s\x1b[0m', '✅ MongoDB connection closed');
  } catch (err) {
    console.error(
      '\x1b[31m%s\x1b[0m',
      `❌ Error closing MongoDB connection: \x1b[35m${err}\x1b[0m`,
    );
  }

  process.exit(0);
});