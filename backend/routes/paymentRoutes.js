
const express = require("express");
const router = express.Router();

const Student = require("../models/Student");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const { authMiddleware, requireRole } =
  require("../middleware/authMiddleware");

// POST /api/payments/rfid
router.post(
  "/payments/rfid",
  authMiddleware,
  requireRole("Canteen"),
  async (req, res) => {
    let deductedStudent = null;
    let amountToRestore = 0;
    let createdTransaction = null;
    let createdNotification = null;

    try {
      const rfidCardId = String(req.body.rfidCardId || "").trim();
      const amount = Number(req.body.amount);
      const description =
        String(req.body.description || "Canteen purchase").trim();

      if (
        !rfidCardId ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 100000
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid RFID card ID and purchase amount."
        });
      }

      const roundedAmount = Math.round(amount * 100) / 100;

      const student = await Student.findOne({
        rfidCardId,
        cardStatus: "Active"
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "RFID card is invalid, unlinked, or blocked."
        });
      }

      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(
        weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
      );

      const [dailyTotals, weeklyTotals] = await Promise.all([
        Transaction.aggregate([
          {
            $match: {
              studentId: student.studentId,
              type: "Debit",
              status: "Success",
              createdAt: { $gte: today }
            }
          },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        Transaction.aggregate([
          {
            $match: {
              studentId: student.studentId,
              type: "Debit",
              status: "Success",
              createdAt: { $gte: weekStart }
            }
          },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ])
      ]);

      const spentToday = dailyTotals[0]?.total || 0;
      const spentThisWeek = weeklyTotals[0]?.total || 0;

      if (student.walletBalance < roundedAmount) {
        return res.status(400).json({
          success: false,
          message: "Payment declined: insufficient wallet balance."
        });
      }

      if (spentToday + roundedAmount > student.dailyLimit) {
        return res.status(400).json({
          success: false,
          message: "Payment declined: daily spending limit exceeded."
        });
      }

      if (spentThisWeek + roundedAmount > student.weeklyLimit) {
        return res.status(400).json({
          success: false,
          message: "Payment declined: weekly spending limit exceeded."
        });
      }

      // Atomically deduct only if the balance is still sufficient
      // and the card is still active.
      const updatedStudent = await Student.findOneAndUpdate(
        {
          _id: student._id,
          rfidCardId,
          cardStatus: "Active",
          walletBalance: { $gte: roundedAmount }
        },
        [
          {
            $set: {
              walletBalance: {
                $round: [
                  { $subtract: ["$walletBalance", roundedAmount] },
                  2
                ]
              }
            }
          }
        ],
        { new: true }
      );

      if (!updatedStudent) {
        return res.status(409).json({
          success: false,
          message: "Payment declined. Please retry; the card or balance changed."
        });
      }

      deductedStudent = updatedStudent;
      amountToRestore = roundedAmount;

      createdTransaction = await Transaction.create({
        student: updatedStudent._id,
        studentId: updatedStudent.studentId,
        studentName: updatedStudent.name,
        rfidCardId: updatedStudent.rfidCardId,
        amount: roundedAmount,
        type: "Debit",
        description,
        paymentMethod: "RFID",
        status: "Success"
      });

      createdNotification = await Notification.create({
        student: updatedStudent._id,
        title: "Canteen payment",
        message: `₹${roundedAmount.toFixed(2)} was spent at the canteen.`,
        type: "Payment"
      });

      return res.json({
        success: true,
        message: "Payment successful.",
        payment: {
          studentId: updatedStudent.studentId,
          studentName: updatedStudent.name,
          amount: roundedAmount,
          balance: updatedStudent.walletBalance
        }
      });
    } catch (error) {
      console.error("RFID payment error:", error.message);

      // Best-effort cleanup if recording the payment fails.
      try {
        if (createdNotification) {
          await Notification.deleteOne({ _id: createdNotification._id });
        }

        if (createdTransaction) {
          await Transaction.deleteOne({ _id: createdTransaction._id });
        }

        if (deductedStudent && amountToRestore > 0) {
          await Student.updateOne(
            { _id: deductedStudent._id },
            {
              $inc: { walletBalance: amountToRestore }
            }
          );
        }
      } catch (rollbackError) {
        console.error(
          "RFID payment recovery error:",
          rollbackError.message
        );
      }

      return res.status(500).json({
        success: false,
        message: "Could not process the payment. Check the wallet and transaction records."
      });
    }
  }
);

module.exports = router;
