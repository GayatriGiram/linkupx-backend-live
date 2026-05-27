const express = require("express");
const router = express.Router();
const otpGenerator = require("otp-generator");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const OTP = require("../models/otpModel");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const cloudinary = require("../config/cloudinary");
const upload = require("../middleware/upload");
const FollowRequest = require("../models/FollowRequest");
const Notification = require("../models/Notification");
// 📧 Mail setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "adityajaiswal7823@gmail.com",
    pass: "irkz qful anpg posz",
  },
});

function validatePassword(password) {
  if (typeof password !== "string") {
    return "Password must be a string";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter";
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number";
  }
  if (!/[!@#\$%^&*(),.?":{}|<>]/.test(password)) {
    return "Password must include at least one special character";
  }
  if (password.includes(" ")) {
    return "Password must not contain spaces";
  }
  return null;
}


// ===============================
// 🔥 1. SEND OTP (FULL DEBUG)
// ===============================
router.post("/send-otp", async (req, res) => {
  try {
    console.log("\n================ SEND OTP ================");
    console.log("📩 REQUEST BODY:", req.body);

    const { email } = req.body;

    if (!email) {
      console.log("❌ EMAIL MISSING");
      return res.status(400).json({ message: "Email is required" });
    }

    const emailNormalized = email.trim().toLowerCase();
    console.log("📧 NORMALIZED EMAIL:", emailNormalized);

    const otp = otpGenerator.generate(6, {
      digits: true,
      alphabets: false,
      upperCase: false,
      specialChars: false,
    });

    console.log("🔢 GENERATED OTP:", otp);

    console.log("🧹 Deleting old OTPs...");
    const deleted = await OTP.deleteMany({ email: emailNormalized });
    console.log("🧹 OLD OTPs DELETED:", deleted.deletedCount);

    console.log("💾 Saving OTP to DB...");
    const savedOtp = await OTP.create({
      email: emailNormalized,
      otp: String(otp).trim(),
    });
    console.log("💾 OTP SAVED:", savedOtp);

    console.log("📧 Sending email...");
    const info = await transporter.sendMail({
      from: '"LinkUpX Support" <adityajaiswal7823@gmail.com>',
      to: emailNormalized,
      subject: "Your LinkUpX OTP Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Welcome to LinkUpX!</h2>
          <p>Your OTP verification code is:</p>
          <h1 style="font-size: 32px; letter-spacing: 2px; color: #4CAF50;">${otp}</h1>
          <p>Please enter this code in the app to complete your registration.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    console.log("📧 EMAIL SENT:", info.response);

    res.status(200).json({
      message: "OTP sent successfully",
    });

    console.log("✅ SEND OTP SUCCESS END\n");

  } catch (err) {
    console.log("🔥 SEND OTP ERROR:");
    console.log(err);
    console.log("STACK:", err.stack);

    res.status(500).json({
      message: "Error sending OTP",
      error: err.message,
    });
  }
});


// ===============================
// 🔥 2. VERIFY OTP (FULL DEBUG)
// ===============================
router.post("/verify-otp", async (req, res) => {
  try {
    console.log("\n================ VERIFY OTP ================");
    console.log("📩 REQUEST BODY:", req.body);

    const { fullName, email, password, role, otp } = req.body;

    // Step 1: Validation
    if (!fullName || !email || !password || !role || !otp) {
      console.log("❌ VALIDATION FAILED - Missing fields");
      return res.status(400).json({ message: "All fields are required" });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      console.log("❌ PASSWORD VALIDATION FAILED:", passwordError);
      return res.status(400).json({ message: passwordError });
    }

    console.log("✅ VALIDATION PASSED");

    // Step 2: Normalize email
    const emailNormalized = email.trim().toLowerCase();
    const otpNormalized = String(otp).trim();

    console.log("📧 EMAIL NORMALIZED:", emailNormalized);
    console.log("🔢 OTP ENTERED:", otpNormalized);

    // Step 3: Find OTP in DB
    console.log("🔍 Searching OTP in DB...");
    const otpRecord = await OTP.findOne({
      email: emailNormalized,
      otp: otpNormalized,
    });

    console.log("📦 OTP RECORD FOUND:", otpRecord);

    if (!otpRecord) {
      console.log("❌ OTP NOT FOUND / EXPIRED / WRONG");
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    console.log("✅ OTP MATCHED");

    // Step 4: Check user exists
    console.log("🔍 Checking existing user...");
    const existingUser = await User.findOne({
      email: emailNormalized,
    });

    console.log("👤 EXISTING USER:", existingUser);

    if (existingUser) {
      console.log("❌ USER ALREADY EXISTS");
      return res.status(400).json({ message: "User already exists" });
    }

    // Step 5: Create user with hashed password
    console.log("🧑‍💻 Creating user...");
    const user = await User.create({
      fullName: fullName.trim(),
      email: emailNormalized,
      password: password.trim(),
      role: role.trim(),
      isVerified: true,
    });

    console.log("🎉 USER CREATED:", user);

    // Step 6: Delete OTP
    console.log("🧹 Deleting OTP...");
    const deleted = await OTP.deleteMany({ email: emailNormalized });
    console.log("🧹 OTP DELETED COUNT:", deleted.deletedCount);

    res.status(201).json({
      message: "User registered successfully",
      user,
    });

    console.log("✅ VERIFY OTP SUCCESS END\n");

  } catch (err) {
    console.log("🔥 VERIFY OTP ERROR:");
    console.log(err);
    console.log("STACK:", err.stack);

    res.status(500).json({
      message: "Error verifying OTP",
      error: err.message,
    });
  }
});

// =================================== login route (FULL DEBUG) ===================================
router.post("/login", async (req, res) => {
  console.log("\n================ LOGIN API HIT ================");

  try {
    console.log("STEP 1: Request body received");
    console.log("BODY:", req.body);

    const { email, password } = req.body;

    console.log("STEP 2: Validate input");

    if (!email || !password) {
      console.log("❌ Missing fields");
      return res.status(400).json({ message: "Email and password required" });
    }

    const emailNormalized = email.trim().toLowerCase();
    console.log("STEP 3: Email normalized:", emailNormalized);

    const user = await User.findOne({ email: emailNormalized });

    if (!user) {
      console.log("❌ USER NOT FOUND");
      return res.status(400).json({ message: "User not found" });
    }

    console.log("STEP 4: User found");
    console.log("USER ID:", user._id);
    console.log("USER EMAIL:", user.email);

    console.log("STEP 5: Password check start");

    console.log("ENTERED PASSWORD:", password);
    console.log("DB HASHED PASSWORD:", user.password);

    // 🔥 IMPORTANT FIX: force string safety
    const isMatch = await bcrypt.compare(
      String(password),
      String(user.password)
    );

    console.log("STEP 6: bcrypt compare result:", isMatch);

    if (!isMatch) {
      console.log("❌ PASSWORD WRONG");
      return res.status(400).json({ message: "Invalid password" });
    }

    console.log("🎉 LOGIN SUCCESS");
const token = jwt.sign(
  {
    id: user._id,
    email: user.email,
    role: user.role
  },
  "SECRET_KEY_123",   // change later to env variable
  { expiresIn: "7d" }
);

console.log("TOKEN GENERATED:", token);

return res.status(200).json({
  message: "Login successful",
  user,
  token
});
  

  } catch (err) {
    console.log("🔥 LOGIN ERROR:", err.message);
    return res.status(500).json({
      message: "Login error",
      error: err.message,
    });

  } finally {
    console.log("================ LOGIN END ================\n");
  }
});


// ===================================
// 🔐 FORGOT PASSWORD - SEND OTP
// ===================================
router.post("/forgot-password/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const emailNormalized = email.trim().toLowerCase();
    const user = await User.findOne({ email: emailNormalized });

    if (!user) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    const otp = otpGenerator.generate(6, {
      digits: true,
      alphabets: false,
      upperCase: false,
      specialChars: false,
    });

    await OTP.deleteMany({ email: emailNormalized });
    await OTP.create({ email: emailNormalized, otp: String(otp).trim() });

    await transporter.sendMail({
      from: '"LinkUpX Support" <adityajaiswal7823@gmail.com>',
      to: emailNormalized,
      subject: "LinkUpX Password Reset OTP",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>LinkUpX Password Reset</h2>
          <p>You requested a password reset. Your OTP code is:</p>
          <h1 style="font-size: 32px; letter-spacing: 2px; color: #FF5722;">${otp}</h1>
          <p>Please enter this code in the app to reset your password.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.log("🔥 FORGOT PASSWORD SEND OTP ERROR:", err.message);
    return res.status(500).json({ message: "Error sending OTP", error: err.message });
  }
});

// ===================================
// 🔐 FORGOT PASSWORD - RESET PASSWORD
// ===================================
router.post("/forgot-password/reset", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP and new password are required" });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const emailNormalized = email.trim().toLowerCase();
    const otpNormalized = String(otp).trim();

    const user = await User.findOne({ email: emailNormalized });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otpRecord = await OTP.findOne({ email: emailNormalized, otp: otpNormalized });
    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.password = newPassword.trim();
    await user.save();
    await OTP.deleteMany({ email: emailNormalized });

    return res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.log("🔥 FORGOT PASSWORD RESET ERROR:", err.message);
    return res.status(500).json({ message: "Error resetting password", error: err.message });
  }
});

// ===================================
// 🧑‍💼 UPDATE PROFILE
// ===================================
router.put("/update-profile", async (req, res) => {
  try {
    const { 
      userId, fullName, email, role,
      currentCompany, jobRole, location, experience, previousCompanies, 
      skills, linkedinProfile, portfolioWebsite, awards, publications, 
      certifications, mentorshipAvailability, mentorshipDetails,
      pursuing, tenthCollege, tenthMarks, twelfthCollege, twelfthMarks,
      diplomaCollege, diplomaMarks, degree, department, degreeCollege,
      currentYear, cgpa, technicalSkills, softSkills, projects,
      currentCollege, facultyDegree, specialization, university,
      yearsOfExperience, subjectsTaught, previousInstitutions, researchInterests
    } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (fullName !== undefined) {
      if (fullName.trim() === "") {
        return res.status(400).json({ message: "Full name is required" });
      }
      user.fullName = fullName.trim();
    }

    if (email !== undefined) {
      if (email.trim() === "") {
        return res.status(400).json({ message: "Email is required" });
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser && existingUser._id.toString() !== userId) {
          return res.status(400).json({ message: "Email is already in use" });
        }
        user.email = normalizedEmail;
      }
    }

    if (role !== undefined && role.trim()) {
      user.role = role.trim();
    }

    // Alumni Specific Fields
    if (currentCompany !== undefined) user.currentCompany = currentCompany;
    if (jobRole !== undefined) user.jobRole = jobRole;
    if (location !== undefined) user.location = location;
    if (experience !== undefined) user.experience = experience;
    if (previousCompanies !== undefined) user.previousCompanies = previousCompanies;
    if (skills !== undefined) user.skills = skills;
    if (linkedinProfile !== undefined) user.linkedinProfile = linkedinProfile;
    if (portfolioWebsite !== undefined) user.portfolioWebsite = portfolioWebsite;
    if (awards !== undefined) user.awards = awards;
    if (publications !== undefined) user.publications = publications;
    if (certifications !== undefined) user.certifications = certifications;
    if (mentorshipAvailability !== undefined) user.mentorshipAvailability = mentorshipAvailability;
    if (mentorshipDetails !== undefined) user.mentorshipDetails = mentorshipDetails;

    // Student Specific Fields
    if (pursuing !== undefined) user.pursuing = pursuing;
    if (tenthCollege !== undefined) user.tenthCollege = tenthCollege;
    if (tenthMarks !== undefined) user.tenthMarks = tenthMarks;
    if (twelfthCollege !== undefined) user.twelfthCollege = twelfthCollege;
    if (twelfthMarks !== undefined) user.twelfthMarks = twelfthMarks;
    if (diplomaCollege !== undefined) user.diplomaCollege = diplomaCollege;
    if (diplomaMarks !== undefined) user.diplomaMarks = diplomaMarks;
    if (degree !== undefined) user.degree = degree;
    if (department !== undefined) user.department = department;
    if (degreeCollege !== undefined) user.degreeCollege = degreeCollege;
    if (currentYear !== undefined) user.currentYear = currentYear;
    if (cgpa !== undefined) user.cgpa = cgpa;
    if (technicalSkills !== undefined) user.technicalSkills = technicalSkills;
    if (softSkills !== undefined) user.softSkills = softSkills;
    if (projects !== undefined) user.projects = projects;

    // Faculty Specific Fields
    if (currentCollege !== undefined) user.currentCollege = currentCollege;
    if (facultyDegree !== undefined) user.facultyDegree = facultyDegree;
    if (specialization !== undefined) user.specialization = specialization;
    if (university !== undefined) user.university = university;
    if (yearsOfExperience !== undefined) user.yearsOfExperience = yearsOfExperience;
    if (subjectsTaught !== undefined) user.subjectsTaught = subjectsTaught;
    if (previousInstitutions !== undefined) user.previousInstitutions = previousInstitutions;
    if (researchInterests !== undefined) user.researchInterests = researchInterests;

    await user.save();

    return res.status(200).json({ message: "Profile updated successfully", user });
  } catch (err) {
    console.log("🔥 UPDATE PROFILE ERROR:", err.message);
    return res.status(500).json({ message: "Error updating profile", error: err.message });
  }
});

// ===================================
// 📄 UPDATE RESUME
// ===================================
router.post("/update-resume", upload.single("resume"), async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: "User not found" });
    }

    const filePath = req.file.path;

    const uploadResult = await cloudinary.uploader.upload(filePath, {
      folder: "resumes",
      resource_type: "auto",
      use_filename: true,
      unique_filename: false,
    });

    const resumeUrl = uploadResult.secure_url;

    fs.unlink(filePath, (err) => {
      if (err) console.log("⚠️ Failed to delete temp file:", err);
    });

    user.resumeUrl = resumeUrl;
    const savedUser = await user.save();

    return res.status(200).json({ 
      message: "Resume updated successfully", 
      user: savedUser 
    });
  } catch (err) {
    console.log("🔥 UPDATE RESUME ERROR:", err.message);
    return res.status(500).json({ message: "Error updating resume", error: err.message });
  }
});

// ===================================
// 🖼️ UPDATE PROFILE IMAGE
// ===================================
router.post("/update-profile-image", upload.single("image"), async (req, res) => {
  try {
    console.log("\n================ UPDATE PROFILE IMAGE ================");
    const { userId, profileImage } = req.body;

    if (!userId) {
      console.log("❌ userId is missing");
      return res.status(400).json({ message: "userId is required" });
    }

    if (!req.file && (!profileImage || profileImage.trim().length === 0)) {
      console.log("❌ image file or profileImage data is missing");
      return res.status(400).json({ message: "Image file or profileImage string is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log("❌ User not found for ID:", userId);
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ User found:", user.email);

    let imageUrl;
    if (req.file) {
      const filePath = req.file.path;
      console.log("✅ file path:", filePath);

      const uploadResult = await cloudinary.uploader.upload(filePath, {
        folder: "profiles",
        use_filename: true,
        unique_filename: false,
        transformation: [{ width: 500, height: 500, crop: "limit" }],
      });

      imageUrl = uploadResult.secure_url;

      fs.unlink(filePath, (err) => {
        if (err) console.log("⚠️ Failed to delete temp file:", err);
      });
    } else {
      imageUrl = profileImage;
    }

    user.profileImage = imageUrl;
    const savedUser = await user.save();

    console.log("✅ Profile image uploaded and saved successfully");

    return res.status(200).json({ 
      message: "Profile image updated successfully", 
      user: savedUser 
    });
  } catch (err) {
    console.log("🔥 UPDATE PROFILE IMAGE ERROR:", err.message);
    console.log("STACK:", err.stack);
    return res.status(500).json({ message: "Error updating profile image", error: err.message });
  } finally {
    console.log("================ UPDATE PROFILE IMAGE END ================\n");
  }
});

// ===================================
// 👥 FOLLOW USER
// ===================================
router.post("/follow/:userId", async (req, res) => {
  try {
    const { currentUserId } = req.body;
    const userIdToFollow = req.params.userId;

    if (!currentUserId || !userIdToFollow) {
      return res.status(400).json({ message: "currentUserId and userId required" });
    }

    if (currentUserId === userIdToFollow) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const currentUser = await User.findById(currentUserId);
    const userToFollow = await User.findById(userIdToFollow);

    if (!currentUser || !userToFollow) {
      return res.status(404).json({ message: "User not found" });
    }

    if (currentUser.following.includes(userIdToFollow)) {
      return res.status(400).json({ message: "Already following this user" });
    }

    currentUser.following.push(userIdToFollow);
    userToFollow.followers.push(currentUserId);

    await currentUser.save();
    await userToFollow.save();

    return res.status(200).json({ 
      message: "Followed successfully",
      following: currentUser.following,
      followers: userToFollow.followers
    });
  } catch (err) {
    console.log("🔥 FOLLOW ERROR:", err.message);
    return res.status(500).json({ message: "Error following user", error: err.message });
  }
});

// ===================================
// 👥 UNFOLLOW USER
// ===================================
router.post("/unfollow/:userId", async (req, res) => {
  try {
    const { currentUserId } = req.body;
    const userIdToUnfollow = req.params.userId;

    if (!currentUserId || !userIdToUnfollow) {
      return res.status(400).json({ message: "currentUserId and userId required" });
    }

    const currentUser = await User.findById(currentUserId);
    const userToUnfollow = await User.findById(userIdToUnfollow);

    if (!currentUser || !userToUnfollow) {
      return res.status(404).json({ message: "User not found" });
    }

    currentUser.following = currentUser.following.filter(id => id.toString() !== userIdToUnfollow);
    userToUnfollow.followers = userToUnfollow.followers.filter(id => id.toString() !== currentUserId);

    await currentUser.save();
    await userToUnfollow.save();

    // Also remove any follow requests between these two
    await FollowRequest.deleteMany({
      $or: [
        { sender: currentUserId, receiver: userIdToUnfollow },
        { sender: userIdToUnfollow, receiver: currentUserId }
      ]
    });

    return res.status(200).json({ 
      message: "Unfollowed successfully",
      following: currentUser.following,
      followers: userToUnfollow.followers
    });
  } catch (err) {
    console.log("🔥 UNFOLLOW ERROR:", err.message);
    return res.status(500).json({ message: "Error unfollowing user", error: err.message });
  }
});

// ===================================
// 👥 GET FOLLOWERS LIST
// ===================================
router.get("/followers/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "userId required" });
    }

    const user = await User.findById(userId).populate("followers", "fullName profileImage role email");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      followers: user.followers,
      followersCount: user.followers.length,
    });
  } catch (err) {
    console.log("🔥 GET FOLLOWERS ERROR:", err.message);
    return res.status(500).json({ message: "Error fetching followers", error: err.message });
  }
});

// ===================================
// 👥 GET FOLLOWING LIST
// ===================================
router.get("/following/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "userId required" });
    }

    const user = await User.findById(userId).populate("following", "fullName profileImage role email");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      following: user.following,
      followingCount: user.following.length,
    });
  } catch (err) {
    console.log("🔥 GET FOLLOWING ERROR:", err.message);
    return res.status(500).json({ message: "Error fetching following", error: err.message });
  }
});

// ===================================
// 👥 CHECK IF FOLLOWING
// ===================================
router.get("/is-following/:currentUserId/:userId", async (req, res) => {
  try {
    const { currentUserId, userId } = req.params;

    if (!currentUserId || !userId) {
      return res.status(400).json({ message: "Both user IDs required" });
    }

    const currentUser = await User.findById(currentUserId);

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const isFollowing = currentUser.following.includes(userId);

    return res.status(200).json({
      success: true,
      isFollowing,
    });
  } catch (err) {
    console.log("🔥 CHECK FOLLOWING ERROR:", err.message);
    return res.status(500).json({ message: "Error checking follow status", error: err.message });
  }
});

// ===================================
// 👥 SEND FOLLOW REQUEST (FOLLOW + REQUEST)
// ===================================
router.post("/send-follow-request", async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    if (!senderId || !receiverId) {
      return res.status(400).json({ message: "senderId and receiverId required" });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      return res.status(404).json({ message: "User not found" });
    }

    // 1. Immediate Follow (Sender follows Receiver)
    if (!sender.following.includes(receiverId)) {
      sender.following.push(receiverId);
      receiver.followers.push(senderId);
      await sender.save();
      await receiver.save();
    }

    // 2. Create Follow Back Request (Receiver should follow Sender back)
    // BUT only if Receiver is NOT already following Sender
    const isReceiverFollowingSender = receiver.following.includes(senderId);
    
    if (!isReceiverFollowingSender) {
      const existingRequest = await FollowRequest.findOne({ sender: senderId, receiver: receiverId });
      if (!existingRequest) {
        await FollowRequest.create({ sender: senderId, receiver: receiverId, status: "pending" });

        // 🔔 Create Notification
        await Notification.create({
          receiver: receiverId,
          sender: senderId,
          type: "follow_request",
          message: `${sender.fullName} sent you an invite to follow them back.`
        });
      }
    }

    return res.status(200).json({ 
      message: "Followed and request sent successfully",
      following: sender.following 
    });
  } catch (err) {
    console.log("🔥 SEND FOLLOW REQUEST ERROR:", err.message);
    return res.status(500).json({ message: "Error sending request", error: err.message });
  }
});

// ===================================
// 👥 GET PENDING REQUESTS
// ===================================
router.get("/pending-requests/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Find pending requests
    const requests = await FollowRequest.find({ receiver: userId, status: "pending" })
      .populate("sender", "fullName profileImage role email");

    // Filter out requests from people the user is ALREADY following
    const filteredRequests = requests.filter(req => {
      return !user.following.includes(req.sender._id);
    });

    return res.status(200).json({ success: true, requests: filteredRequests });
  } catch (err) {
    console.log("🔥 GET PENDING REQUESTS ERROR:", err.message);
    return res.status(500).json({ message: "Error fetching requests", error: err.message });
  }
});

// ===================================
// 👥 ACCEPT FOLLOW REQUEST
// ===================================
router.post("/accept-follow-request/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await FollowRequest.findById(requestId);

    if (!request || request.status !== "pending") {
      return res.status(404).json({ message: "Pending request not found" });
    }

    const sender = await User.findById(request.sender); // The one who sent the request
    const receiver = await User.findById(request.receiver); // The one who is accepting

    if (!sender || !receiver) {
      return res.status(404).json({ message: "User not found" });
    }

    // Receiver follows Sender back
    if (!receiver.following.includes(sender._id)) {
      receiver.following.push(sender._id);
      sender.followers.push(receiver._id);
      await receiver.save();
      await sender.save();
    }

    request.status = "accepted";
    await request.save();

    // 🔔 Create Notification for the original sender
    await Notification.create({
      receiver: sender._id,
      sender: receiver._id,
      type: "request_accepted",
      message: `${receiver.fullName} accepted your invitation.`
    });

    // 🧹 Delete the original follow_request notification for the receiver
    await Notification.deleteOne({
      receiver: receiver._id,
      sender: sender._id,
      type: "follow_request"
    });

    return res.status(200).json({ message: "Request accepted successfully" });
  } catch (err) {
    console.log("🔥 ACCEPT REQUEST ERROR:", err.message);
    return res.status(500).json({ message: "Error accepting request", error: err.message });
  }
});

// ===================================
// 👥 DECLINE FOLLOW REQUEST
// ===================================
router.post("/decline-follow-request/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await FollowRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    request.status = "rejected";
    await request.save();

    // 🧹 Delete the original follow_request notification for the receiver
    // No need to notify the sender about decline usually, but we clean up the receiver's alerts
    await Notification.deleteOne({
      receiver: request.receiver,
      sender: request.sender,
      type: "follow_request"
    });

    return res.status(200).json({ message: "Request declined" });
  } catch (err) {
    console.log("🔥 DECLINE REQUEST ERROR:", err.message);
    return res.status(500).json({ message: "Error declining request", error: err.message });
  }
});

// ===================================
// 👥 GET SUGGESTED USERS
// ===================================
router.get("/suggested-users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // 1. Get IDs of people already followed
    const followedIds = currentUser.following.map(id => id.toString());

    // 2. Get IDs of people to whom requests have already been sent
    const sentRequests = await FollowRequest.find({ sender: userId }).select("receiver");
    const requestedIds = sentRequests.map(r => r.receiver.toString());

    // 3. Exclude self, followed, and already requested
    const excludeIds = [userId, ...followedIds, ...requestedIds];

    const suggestedUsers = await User.find({ _id: { $nin: excludeIds } })
      .select("fullName profileImage role")
      .limit(10);

    return res.status(200).json({ success: true, users: suggestedUsers });
  } catch (err) {
    console.log("🔥 SUGGESTED USERS ERROR:", err.message);
    return res.status(500).json({ message: "Error fetching suggestions", error: err.message });
  }
});

// ===================================
// 👥 GET USER PROFILE BY ID
// ===================================
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("-password"); // Exclude password

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ success: true, user });
  } catch (err) {
    console.log("🔥 GET USER ERROR:", err.message);
    return res.status(500).json({ message: "Error fetching user profile", error: err.message });
  }
});

// ===================================
// 👥 SEARCH POSTS BY USER NAME
// ===================================
router.get("/search-users", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim() === "") {
      return res.status(200).json({ success: true, posts: [] });
    }

    const Post = require("../models/post");
    const AlumniPost = require("../models/alumnipost");

    // 1. Find users whose names match the query
    const users = await User.find({ fullName: { $regex: query, $options: "i" } }).select("_id");
    const userIds = users.map(u => u._id);

    // 2. Search in standard posts (by snapshot name, user ID, OR content)
    const standardPosts = await Post.find({
      $or: [
        { "userSnapshot.fullName": { $regex: query, $options: "i" } },
        { user: { $in: userIds } },
        { content: { $regex: query, $options: "i" } }
      ]
    })
    .populate("user", "fullName profileImage role")
    .populate({ path: "comments.user", select: "fullName profileImage role" })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    // 3. Search in alumni posts (by snapshot name, user ID, content, OR job details)
    const alumniPosts = await AlumniPost.find({
      $or: [
        { "userSnapshot.fullName": { $regex: query, $options: "i" } },
        { user: { $in: userIds } },
        { content: { $regex: query, $options: "i" } },
        { "jobDetails.role": { $regex: query, $options: "i" } },
        { "jobDetails.company": { $regex: query, $options: "i" } },
        { "jobDetails.description": { $regex: query, $options: "i" } },
        { "jobDetails.type": { $regex: query, $options: "i" } },
        { "jobDetails.location": { $regex: query, $options: "i" } }
      ]
    })
    .populate("user", "fullName profileImage role")
    .populate({ path: "comments.user", select: "fullName profileImage role" })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    // 4. Combine and sort
    const allPosts = [...standardPosts, ...alumniPosts].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    return res.status(200).json({ success: true, posts: allPosts });
  } catch (err) {
    console.log("🔥 SEARCH POSTS ERROR:", err.message);
    return res.status(500).json({ message: "Error searching posts", error: err.message });
  }
});

module.exports = router;