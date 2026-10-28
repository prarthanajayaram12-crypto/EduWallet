
const express = require("express");
const router = express.Router();

const Notification = require("../models/Notification");
const Student = require("../models/Student");
const { authMiddleware } = require("../middleware/authMiddleware");

// GET /api/notifications
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const { role, studentId } = req.user;

    if (!["Admin", "Parent", "Student", "Canteen"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "You cannot view notifications."
      });
    }

    let filter = {};

    if (role === "Parent" || role === "Student") {
      if (!studentId) {
        return res.status(403).json({
          success: false,
          message: "Your account is not linked to a student."
        });
      }

      const student = await Student.findOne({ studentId });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student record not found."
        });
      }

      filter.student = student._id;
    }

    // Canteen users can view payment notifications only.
    if (role === "Canteen") {
      filter.type = "Payment";
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ success: true, notifications });
  } catch (error) {
    console.error("Notification retrieval error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load notifications."
    });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/notifications/:id/read", authMiddleware, async (req, res) => {
  try {
    const { role, studentId } = req.user;

    // Canteen can view notifications but cannot mark them as read.
    if (!["Admin", "Parent", "Student"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "You cannot update notifications."
      });
    }

    const filter = { _id: req.params.id };

    if (role !== "Admin") {
      if (!studentId) {
        return res.status(403).json({
          success: false,
          message: "Your account is not linked to a student."
        });
      }

      const student = await Student.findOne({ studentId });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student record not found."
        });
      }

      filter.student = student._id;
    }

    const notification = await Notification.findOneAndUpdate(
      filter,
      { $set: { isRead: true } },
      { new: true, runValidators: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found."
      });
    }

    return res.json({
      success: true,
      message: "Notification marked as read.",
      notification
    });
  } catch (error) {
    console.error("Notification update error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not update notification."
    });
  }
});

module.exports = router;
