
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./db");

// Route imports
const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const rfidRoutes = require("./routes/rfidRoutes");
const walletRoutes = require("./routes/walletRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const razorpayRoutes = require("./routes/razorpayRoutes");
const parentRoutes = require("./routes/parentRoutes");
const demandRoutes = require("./routes/demandRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Backend home route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "EduWallet Backend is running!"
  });
});

// API routes
app.use("/api", authRoutes);
app.use("/api", studentRoutes);
app.use("/api", rfidRoutes);
app.use("/api", walletRoutes);
app.use("/api", transactionRoutes);
app.use("/api", notificationRoutes);
app.use("/api", paymentRoutes);
app.use("/api", razorpayRoutes);
app.use("/api", parentRoutes);
app.use("/api", demandRoutes);

// Start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `EduWallet Backend running at http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to start EduWallet:", error.message);
    process.exit(1);
  }
}

startServer();
