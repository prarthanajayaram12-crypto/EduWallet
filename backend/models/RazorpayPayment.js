
const mongoose = require("mongoose");

const razorpayPaymentSchema = new mongoose.Schema(
  {
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true
    },

    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
      default: undefined
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },

    studentId: {
      type: String,
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 1
    },

    currency: {
      type: String,
      default: "INR"
    },

    status: {
      type: String,
      enum: ["Created", "Paid", "Credited", "Failed"],
      default: "Created"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "RazorpayPayment",
  razorpayPaymentSchema
);
