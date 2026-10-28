
const express = require("express");
const Student = require("../models/Student");
const { authMiddleware, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// View all RFID cards
router.get("/rfid-cards", authMiddleware, requireRole("Admin"), async (req, res) => {
  try {
    const students = await Student.find(
      {},
      "studentId name className rfidCardId cardStatus"
    ).sort({ name: 1 });

    res.json({ success: true, cards: students });
  } catch (error) {
    console.error("Load RFID cards:", error.message);
    res.status(500).json({ success: false, message: "Could not load RFID cards." });
  }
});

// Link an RFID card to a student
router.post("/rfid-cards/link", authMiddleware, requireRole("Admin"), async (req, res) => {
  try {
    const { studentId, rfidCardId } = req.body;

    if (!studentId?.trim() || !rfidCardId?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Student ID and RFID card ID are required."
      });
    }

    const cardId = rfidCardId.trim();
    const student = await Student.findOne({ studentId: studentId.trim() });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const existingCard = await Student.findOne({
      rfidCardId: cardId,
      _id: { $ne: student._id }
    });

    if (existingCard) {
      return res.status(409).json({
        success: false,
        message: "This RFID card is already linked to another student."
      });
    }

    student.rfidCardId = cardId;
    student.cardStatus = "Active";
    await student.save();

    res.json({
      success: true,
      message: "RFID card linked successfully.",
      card: student
    });
  } catch (error) {
    console.error("Link RFID card:", error.message);
    res.status(500).json({ success: false, message: "Could not link RFID card." });
  }
});

// Block or unblock a linked RFID card
router.patch("/rfid-cards/status", authMiddleware, requireRole("Admin"), async (req, res) => {
  try {
    const { studentId, cardStatus } = req.body;

    if (!studentId?.trim() || !["Active", "Blocked"].includes(cardStatus)) {
      return res.status(400).json({
        success: false,
        message: "Provide a student ID and status of Active or Blocked."
      });
    }

    const student = await Student.findOne({ studentId: studentId.trim() });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    if (!student.rfidCardId) {
      return res.status(400).json({
        success: false,
        message: "This student has no linked RFID card."
      });
    }

    student.cardStatus = cardStatus;
    await student.save();

    res.json({
      success: true,
      message: `RFID card ${cardStatus.toLowerCase()} successfully.`,
      card: student
    });
  } catch (error) {
    console.error("Update RFID status:", error.message);
    res.status(500).json({ success: false, message: "Could not update RFID status." });
  }
});

// Unlink an RFID card
router.delete("/rfid-cards/:studentId", authMiddleware, requireRole("Admin"), async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.studentId });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    student.rfidCardId = undefined;
    student.cardStatus = "Unlinked";
    await student.save();

    res.json({ success: true, message: "RFID card unlinked successfully." });
  } catch (error) {
    console.error("Unlink RFID card:", error.message);
    res.status(500).json({ success: false, message: "Could not unlink RFID card." });
  }
});

module.exports = router;
