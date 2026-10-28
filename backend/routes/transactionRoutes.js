
const express = require("express");
const router = express.Router();

const Transaction = require("../models/Transaction");
const { authMiddleware } = require("../middleware/authMiddleware");

// GET /api/transactions
router.get("/transactions", authMiddleware, async (req, res) => {
  try {
    const { role, studentId: linkedStudentId } = req.user;
    const requestedStudentId = String(req.query.studentId || "").trim();

    let filter = {};

    if (role === "Admin") {
      if (requestedStudentId) {
        filter.studentId = requestedStudentId;
      }
    } else if (role === "Parent" || role === "Student") {
      if (!linkedStudentId) {
        return res.status(403).json({
          message: "Your account is not linked to a student."
        });
      }

      if (requestedStudentId && requestedStudentId !== linkedStudentId) {
        return res.status(403).json({
          message: "You cannot view another student's transactions."
        });
      }

      filter.studentId = linkedStudentId;
    } else if (role === "Canteen") {
      // Canteen can view transaction history, optionally for one student.
      if (requestedStudentId) {
        filter.studentId = requestedStudentId;
      }
    } else {
      return res.status(403).json({
        message: "You do not have permission to view transactions."
      });
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return res.json({ success: true, transactions });
  } catch (error) {
    console.error("Transaction history error:", error.message);
    return res.status(500).json({
      message: "Unable to load transactions."
    });
  }
});

module.exports = router;
