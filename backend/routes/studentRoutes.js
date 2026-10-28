
const express = require("express");
const Student = require("../models/Student");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// Get all students — Admin only
router.get("/students", authMiddleware, requireRole("Admin"), async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json({ success: true, students });
  } catch (error) {
    console.error("Load students error:", error.message);
    res.status(500).json({ success: false, message: "Could not load students." });
  }
});

// Add a student — Admin only
router.post("/students", authMiddleware, requireRole("Admin"), async (req, res) => {
  try {
    const { studentId, name, className, parentName } = req.body;

    if (!studentId?.trim() || !name?.trim() || !className?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Student ID, name and class are required."
      });
    }

    const student = await Student.create({
      studentId: studentId.trim(),
      name: name.trim(),
      className: className.trim(),
      parentName: parentName?.trim() || ""
    });

    res.status(201).json({
      success: true,
      message: "Student added successfully.",
      student
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Student ID or RFID card is already registered."
      });
    }

    console.error("Add student error:", error.message);
    res.status(500).json({ success: false, message: "Could not add student." });
  }
});

module.exports = router;
