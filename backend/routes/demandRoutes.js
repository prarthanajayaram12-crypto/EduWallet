
const express = require("express");
const router = express.Router();

const Transaction = require("../models/Transaction");
const { authMiddleware } = require("../middleware/authMiddleware");

router.get("/demand/prediction", authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      type: "Debit",
      paymentMethod: "RFID",
      status: "Success"
    }).sort({ createdAt: -1 });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const itemStats = {};

    for (const transaction of transactions) {
      const item = (transaction.description || "").trim() || "Other";

      if (!itemStats[item]) {
        itemStats[item] = {
          item,
          totalOrders: 0,
          totalRevenue: 0,
          recentOrders: 0
        };
      }

      itemStats[item].totalOrders += 1;
      itemStats[item].totalRevenue += transaction.amount;

      if (transaction.createdAt >= sevenDaysAgo) {
        itemStats[item].recentOrders += 1;
      }
    }

    const predictions = Object.values(itemStats)
      .map((stats) => ({
        ...stats,
        estimatedNextWeek: stats.recentOrders,
        demandLevel:
          stats.recentOrders >= 5
            ? "High"
            : stats.recentOrders >= 2
            ? "Medium"
            : "Low"
      }))
      .sort((a, b) => b.recentOrders - a.recentOrders);

    res.json({
      success: true,
      message: "Canteen demand prediction generated successfully.",
      totalPurchases: transactions.length,
      predictions
    });
  } catch (error) {
    console.error("Demand prediction error:", error);
    res.status(500).json({
      success: false,
      message: "Could not generate demand prediction."
    });
  }
});

module.exports = router;
