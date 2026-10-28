
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const Razorpay = require("razorpay");

const { authMiddleware } = require("../middleware/authMiddleware");
const Student = require("../models/Student");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const RazorpayPayment = require("../models/RazorpayPayment");

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret || !keyId.startsWith("rzp_test_")) {
    throw new Error("RAZORPAY_NOT_CONFIGURED");
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// Create an order
router.post("/razorpay/create-order", authMiddleware, async (req, res) => {
  try {
    if (!["Parent", "Admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only parents or admins can add money."
      });
    }

    const amount = Number(req.body.amount);
    const { studentId } = req.body;

    if (!Number.isFinite(amount) || amount < 1 || amount > 50000) {
      return res.status(400).json({
        success: false,
        message: "Enter an amount between ₹1 and ₹50,000."
      });
    }

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required."
      });
    }

    if (req.user.role === "Parent" && req.user.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: "You can only add money to your linked student's wallet."
      });
    }

    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found."
      });
    }

    const razorpay = getRazorpayInstance();
    const amountInPaise = Math.round(amount * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `ew_${Date.now()}`
    });

    await RazorpayPayment.create({
      razorpayOrderId: order.id,
      student: student._id,
      studentId: student.studentId,
      amount: amountInPaise,
      currency: "INR",
      status: "Created"
    });

    return res.json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      studentId: student.studentId
    });
  } catch (error) {
    console.error("Razorpay order error:", error.message);

    if (error.message === "RAZORPAY_NOT_CONFIGURED") {
      return res.status(503).json({
        success: false,
        message: "Configure valid Razorpay test keys in the backend .env file."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create payment order."
    });
  }
});

// Verify payment and credit the wallet
router.post("/razorpay/verify-payment", authMiddleware, async (req, res) => {
  try {
    if (!["Parent", "Admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only parents or admins can verify wallet top-ups."
      });
    }

    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature
    } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: "Missing Razorpay payment details."
      });
    }

    const paymentRecord = await RazorpayPayment.findOne({
      razorpayOrderId: orderId
    });

    if (!paymentRecord) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found."
      });
    }

    if (req.user.role === "Parent" && req.user.studentId !== paymentRecord.studentId) {
      return res.status(403).json({
        success: false,
        message: "You cannot credit another student's wallet."
      });
    }

    if (paymentRecord.status === "Credited") {
      return res.json({
        success: true,
        message: "This payment has already been credited."
      });
    }

    if (paymentRecord.status !== "Created") {
      return res.status(409).json({
        success: false,
        message: "This payment is already being processed or needs review."
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(503).json({
        success: false,
        message: "Razorpay is not configured."
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const supplied = Buffer.from(signature, "hex");
    const expected = Buffer.from(expectedSignature, "hex");

    if (
      supplied.length !== expected.length ||
      !crypto.timingSafeEqual(supplied, expected)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature."
      });
    }

    const razorpay = getRazorpayInstance();
    const razorpayPayment = await razorpay.payments.fetch(paymentId);

    if (
      razorpayPayment.order_id !== orderId ||
      razorpayPayment.status !== "captured" ||
      razorpayPayment.amount !== paymentRecord.amount ||
      razorpayPayment.currency !== paymentRecord.currency
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment is not captured or its details do not match."
      });
    }

    // Atomically claim this order so concurrent requests cannot credit it twice.
    const claimedPayment = await RazorpayPayment.findOneAndUpdate(
      { _id: paymentRecord._id, status: "Created" },
      { $set: { status: "Paid", razorpayPaymentId: paymentId } },
      { new: true }
    );

    if (!claimedPayment) {
      const latest = await RazorpayPayment.findById(paymentRecord._id);

      if (latest && latest.status === "Credited") {
        return res.json({
          success: true,
          message: "This payment has already been credited."
        });
      }

      return res.status(409).json({
        success: false,
        message: "This payment is already being processed. Please check the wallet."
      });
    }

    const student = await Student.findOne({
      studentId: claimedPayment.studentId
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found. Payment requires review."
      });
    }

    const amountInRupees = claimedPayment.amount / 100;

    // Increment rather than overwrite the current balance.
    const updatedStudent = await Student.findOneAndUpdate(
      { _id: student._id },
      { $inc: { walletBalance: amountInRupees } },
      { new: true }
    );

    if (!updatedStudent) {
      return res.status(500).json({
        success: false,
        message: "Payment verified but wallet credit needs review."
      });
    }

    await Transaction.create({
      student: updatedStudent._id,
      studentId: updatedStudent.studentId,
      studentName: updatedStudent.name,
      amount: amountInRupees,
      type: "Credit",
      description: "Razorpay wallet top-up",
      paymentMethod: "Online",
      status: "Success"
    });

    await Notification.create({
      student: updatedStudent._id,
      title: "Wallet topped up",
      message: `₹${amountInRupees.toFixed(2)} was added to the wallet.`,
      type: "Wallet"
    });

    claimedPayment.status = "Credited";
    await claimedPayment.save();

    return res.json({
      success: true,
      message: "Payment verified and wallet credited successfully.",
      walletBalance: updatedStudent.walletBalance
    });
  } catch (error) {
    console.error("Razorpay verification error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not finish payment verification. Check the payment and wallet before retrying."
    });
  }
});

module.exports = router;
