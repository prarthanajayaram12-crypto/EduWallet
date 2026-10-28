
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

const accounts = [
  {
    loginId: "admin001",
    username: "admin001",
    name: "Admin",
    password: "Admin@123",
    role: "Admin"
  },
  {
    loginId: "parent001",
    username: "parent001",
    name: "Parent",
    password: "Parent@123",
    role: "Parent"
  },
  {
    loginId: "STU001",
    username: "student001",
    name: "Student",
    password: "Student@123",
    role: "Student",
    studentId: "STU001"
  },
  {
    loginId: "canteen001",
    username: "canteen001",
    name: "Canteen Staff",
    password: "Canteen@123",
    role: "Canteen"
  }
];

async function repairAccounts() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Repair the four existing accounts.
    for (const data of accounts) {
      const user = await User.findOne({ loginId: data.loginId });

      if (!user) {
        throw new Error(
          `Existing account not found: ${data.loginId}. No duplicate was deleted.`
        );
      }

      user.username = data.username;
      user.name = data.name;
      user.password = data.password;
      user.role = data.role;

      if (data.studentId) {
        user.studentId = data.studentId;
      }

      await user.save();
      console.log(`Repaired: ${data.username}`);
    }

    // Remove only the extra Admin record identified in the inspection.
    const duplicateAdmin = await User.findOne({
      _id: new mongoose.Types.ObjectId(
        "6ade19e4cd32133364067135"
      ),
      username: "admin001",
      loginId: { $exists: false }
    });

    if (duplicateAdmin) {
      await User.deleteOne({ _id: duplicateAdmin._id });
      console.log("Removed the extra Admin record.");
    } else {
      console.log("Extra Admin record not found; nothing deleted.");
    }

    console.log("Account repair completed.");
  } catch (error) {
    console.error("Repair failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

repairAccounts();
