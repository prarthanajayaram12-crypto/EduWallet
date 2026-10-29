
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Student = require("../models/Student");
const {
  authMiddleware,
  requireRole
} = require("../middleware/authMiddleware");

const router = express.Router();

// Login — all account types
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required."
      });
    }

    const user = await User.findOne({
      username: username.trim(),
      isActive: true
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        studentId: user.studentId
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        studentId: user.studentId
      }
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error during login."
    });
  }
});

// Create Parent, Student or Canteen accounts — Admin only
router.post(
  "/accounts",
  authMiddleware,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const {
        name,
        username,
        password,
        role,
        studentId
      } = req.body;

      if (
        !name?.trim() ||
        !username?.trim() ||
        !password ||
        !role
      ) {
        return res.status(400).json({
          success: false,
          message: "Name, username, password and role are required."
        });
      }

      if (!["Parent", "Student", "Canteen"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Only Parent, Student and Canteen accounts can be created."
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters."
        });
      }

      const cleanUsername = username.trim();
      const cleanStudentId = studentId?.trim();

      // Student and Parent accounts must link to an existing student.
      if (role === "Student" || role === "Parent") {
        if (!cleanStudentId) {
          return res.status(400).json({
            success: false,
            message: "Student ID is required for Parent and Student accounts."
          });
        }

        const student = await Student.findOne({
          studentId: cleanStudentId
        });

        if (!student) {
          return res.status(404).json({
            success: false,
            message: "No student record found with that Student ID."
          });
        }

        // A student can have only one Student login account.
        if (role === "Student") {
          const existingStudentLogin = await User.findOne({
            role: "Student",
            studentId: cleanStudentId
          });

          if (existingStudentLogin) {
            return res.status(409).json({
              success: false,
              message: "This student already has a login account."
            });
          }
        }
      }

      const existingUser = await User.findOne({
        $or: [
          { username: cleanUsername },
          { loginId: cleanUsername }
        ]
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "That username already exists. Choose another."
        });
      }

      const user = new User({
        name: name.trim(),
        username: cleanUsername,
        loginId: cleanUsername,
        password,
        role,
        studentId:
          role === "Student" || role === "Parent"
            ? cleanStudentId
            : null,
        isActive: true
      });

      // User.js hashes the password before saving.
      await user.save();

      return res.status(201).json({
        success: true,
        message: `${role} account created successfully.`,
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          role: user.role,
          studentId: user.studentId
        }
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "That username or login ID already exists."
        });
      }

      console.error("Create account error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not create account."
      });
    }
  }
);

module.exports = router;
