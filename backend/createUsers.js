
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");
const Student = require("./models/Student");

const users = [
  {
    name: "Admin",
    username: "admin001",
    loginId: "admin001",
    password: "Admin@123",
    role: "Admin"
  },
  {
    name: "Parent",
    username: "parent001",
    loginId: "parent001",
    password: "Parent@123",
    role: "Parent",
    studentId: "STU001"
  },
  {
    name: "Student",
    username: "student001",
    loginId: "student001",
    password: "Student@123",
    role: "Student",
    studentId: "STU001"
  },
  {
    name: "Canteen Staff",
    username: "canteen001",
    loginId: "canteen001",
    password: "Canteen@123",
    role: "Canteen"
  }
];

async function createUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected.");

    const student = await Student.findOne({ studentId: "STU001" });

    if (!student) {
      throw new Error(
        "Student STU001 was not found. Create or verify the student record first."
      );
    }

    for (const data of users) {
      let user = await User.findOne({ username: data.username });

      if (!user) {
        user = await User.findOne({ loginId: data.loginId });
      }

      if (user) {
        // Update existing accounts without resetting their passwords.
        user.name = data.name;
        user.username = data.username;
        user.loginId = data.loginId;
        user.role = data.role;

        if (data.role === "Parent" || data.role === "Student") {
          user.studentId = "STU001";
        }

        await user.save();
        console.log(`Updated: ${data.username}`);
      } else {
        // Create only accounts that do not already exist.
        await User.create(data);
        console.log(`Created: ${data.username}`);
      }
    }

    console.log("User setup completed successfully.");
  } catch (error) {
    console.error("User setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

createUsers();
