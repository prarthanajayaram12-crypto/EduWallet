
const mongoose = require("mongoose");

async function connectDB() {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error("MONGO_URI is missing from environment variables");
    }

    await mongoose.connect(mongoURI);

    console.log("MongoDB Atlas connected successfully!");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

module.exports = connectDB;
