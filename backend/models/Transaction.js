
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },
    studentId: {
      type: String,
      required: true
    },
    studentName: {
      type: String,
      required: true
    },
    rfidCardId: {
      type: String,
      default: null
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    type: {
      type: String,
      enum: ["Credit", "Debit"],
      required: true
    },
    description: {
      type: String,
      default: ""
    },
    paymentMethod: {
      type: String,
      enum: ["RFID", "Online", "Cash", "Other"],
      default: "RFID"
    },
    status: {
      type: String,
      enum: ["Success", "Failed", "Pending"],
      default: "Success"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
