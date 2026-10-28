
const express = require("express");
const Student = require("../models/Student");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// View wallet balance
router.get(
  "/wallet/:studentId",
  authMiddleware,
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const isAdmin = req.user.role === "Admin";
      const isParent = req.user.role === "Parent";
      const isStudent = req.user.role === "Student";

      if (!isAdmin && !isParent && !isStudent) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to view this wallet."
        });
      }

      // Parents and students can access only their linked student.
      if (
        !isAdmin &&
        (!req.user.studentId || req.user.studentId !== studentId)
      ) {
        return res.status(403).json({
          success: false,
          message: "You cannot access this student's wallet."
        });
      }

      const student = await Student.findOne({ studentId });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found."
        });
      }

      res.json({
        success: true,
        wallet: {
          studentId: student.studentId,
          studentName: student.name,
          balance: student.walletBalance,
          dailyLimit: student.dailyLimit,
          weeklyLimit: student.weeklyLimit
        }
      });
    } catch (error) {
      console.error("Wallet balance error:", error.message);
      res.status(500).json({
        success: false,
        message: "Could not load wallet balance."
      });
    }
  }
);

// Add money to a student's wallet
router.post(
  "/wallet/topup",
  authMiddleware,
  requireRole("Admin", "Parent"),
  async (req, res) => {
    try {
      const { studentId, amount, paymentMethod } = req.body;
      const value = Number(amount);

      if (
        typeof studentId !== "string" ||
        !studentId.trim() ||
        !Number.isFinite(value) ||
        value <= 0 ||
        value > 100000
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid student ID and amount."
        });
      }

      if (
        paymentMethod &&
        !["Online", "Cash", "Other"].includes(paymentMethod)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment method."
        });
      }

      if (
        req.user.role === "Parent" &&
        (!req.user.studentId || req.user.studentId !== studentId.trim())
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only add money to your linked student's wallet."
        });
      }

      const student = await Student.findOne({
        studentId: studentId.trim()
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found."
        });
      }

      const roundedAmount = Math.round(value * 100) / 100;
      const newBalance =
        Math.round((student.walletBalance + roundedAmount) * 100) / 100;

      // Save the updated balance.
      student.walletBalance = newBalance;
      await student.save();

      try {
        // Record the wallet credit.
        await Transaction.create({
          student: student._id,
          studentId: student.studentId,
          studentName: student.name,
          rfidCardId: student.rfidCardId || "",
          amount: roundedAmount,
          type: "Credit",
          description: "Wallet top-up",
          paymentMethod: paymentMethod || "Online",
          status: "Success"
        });

        // Notify the parent through the notification system.
        await Notification.create({
          student: student._id,
          title: "Wallet topped up",
          message: `₹${roundedAmount.toFixed(2)} was added to ${student.name}'s wallet.`,
          type: "Wallet"
        });
      } catch (recordError) {
        // Avoid leaving a credited balance without its transaction record.
        student.walletBalance = Math.round(
          (newBalance - roundedAmount) * 100
        ) / 100;
        await student.save();
        throw recordError;
      }

      res.json({
        success: true,
        message: "Wallet topped up successfully.",
        wallet: {
          studentId: student.studentId,
          studentName: student.name,
          amountAdded: roundedAmount,
          balance: student.walletBalance
        }
      });
    } catch (error) {
      console.error("Wallet top-up error:", error.message);
      res.status(500).json({
        success: false,
        message: "Could not complete wallet top-up."
      });
    }
  }
);

/* UPDATE SPENDING LIMITS
   PATCH /api/wallet/limits
*/
router.patch(
  "/wallet/limits",
  authMiddleware,
  async (req, res) => {
    try {
      const { studentId, dailyLimit, weeklyLimit } = req.body;
      const role = req.user.role;
      const linkedStudentId = req.user.studentId;

      if (!["Admin", "Parent"].includes(role)) {
        return res.status(403).json({
          message: "Only Admin or Parent can update spending limits."
        });
      }

      if (!studentId) {
        return res.status(400).json({
          message: "Student ID is required."
        });
      }

      if (
        role === "Parent" &&
        linkedStudentId !== studentId
      ) {
        return res.status(403).json({
          message: "You can only update your linked student's limits."
        });
      }

      const updates = {};

      if (dailyLimit !== undefined) {
        const value = Number(dailyLimit);

        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json({
            message: "Daily limit must be zero or greater."
          });
        }

        updates.dailyLimit = value;
      }

      if (weeklyLimit !== undefined) {
        const value = Number(weeklyLimit);

        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json({
            message: "Weekly limit must be zero or greater."
          });
        }

        updates.weeklyLimit = value;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          message: "Provide a daily limit or weekly limit."
        });
      }

      const student = await Student.findOneAndUpdate(
        { studentId },
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!student) {
        return res.status(404).json({
          message: "Student not found."
        });
      }

      return res.json({
        success: true,
        message: "Spending limits updated successfully.",
        student: {
          studentId: student.studentId,
          dailyLimit: student.dailyLimit,
          weeklyLimit: student.weeklyLimit
        }
      });
    } catch (error) {
      console.error("Spending limit update error:", error.message);
      return res.status(500).json({
        message: "Unable to update spending limits."
      });
    }
  }
);

module.exports = router;
