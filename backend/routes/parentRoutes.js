
const express = require("express");
const User = require("../models/User");
const Student = require("../models/Student");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// Create a parent login account — Admin only
router.post(
  "/parents",
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const { name, username, password, studentId } = req.body;

      if (!name?.trim() || !username?.trim() || !password || !studentId?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name, username, password and Student ID are required."
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters."
        });
      }

      const student = await Student.findOne({
        studentId: studentId.trim()
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student ID not found. Add the student first."
        });
      }

      const existingUser = await User.findOne({
        username: username.trim()
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "This username is already taken."
        });
      }

      const parent = await User.create({
        name: name.trim(),
        username: username.trim(),
        password,
        role: "Parent",
        studentId: student.studentId,
        isActive: true
      });

      return res.status(201).json({
        success: true,
        message: "Parent account created successfully.",
        parent: {
          name: parent.name,
          username: parent.username,
          role: parent.role,
          studentId: parent.studentId
        }
      });
    } catch (error) {
      console.error("Create parent error:", error.message);

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "Username already exists."
        });
      }

      return res.status(500).json({
        success: false,
        message: "Could not create parent account."
      });
    }
  }
);

module.exports = router;
