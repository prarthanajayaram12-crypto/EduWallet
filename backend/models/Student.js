
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    className: {
      type: String,
      required: true
    },
    parentName: {
      type: String,
      default: ""
    },
    rfidCardId: {
      type: String,
      default: null,
      unique: true,
      sparse: true
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    dailyLimit: {
      type: Number,
      default: 100,
      min: 0
    },
    weeklyLimit: {
      type: Number,
      default: 500,
      min: 0
    },
    cardStatus: {
      type: String,
      enum: ["Active", "Blocked", "Unlinked"],
      default: "Unlinked"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);
