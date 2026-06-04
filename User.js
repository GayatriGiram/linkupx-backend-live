const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    profileImage: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      enum: ["student", "alumni", "faculty", "admin"],
      default: "student",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Professional Profile for Alumni
    currentCompany: { type: String, default: "" },
    jobRole: { type: String, default: "" },
    location: { type: String, default: "" },
    experience: { type: String, default: "" },
    previousCompanies: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    linkedinProfile: { type: String, default: "" },
    portfolioWebsite: { type: String, default: "" },
    awards: { type: [String], default: [] },
    publications: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    mentorshipAvailability: { type: Boolean, default: false },
    mentorshipDetails: { type: String, default: "" },

    // Student Profile Fields
    pursuing: { type: String, default: "" },
    tenthCollege: { type: String, default: "" },
    tenthMarks: { type: String, default: "" },
    twelfthCollege: { type: String, default: "" },
    twelfthMarks: { type: String, default: "" },
    diplomaCollege: { type: String, default: "" },
    diplomaMarks: { type: String, default: "" },
    degree: { type: String, default: "" },
    department: { type: String, default: "" },
    degreeCollege: { type: String, default: "" },
    currentYear: { type: String, default: "" },
    cgpa: { type: String, default: "" },
    technicalSkills: { type: [String], default: [] },
    softSkills: { type: [String], default: [] },
    projects: { 
      type: [{
        title: String,
        description: String,
        technologies: String,
        githubLink: String
      }], 
      default: [] 
    },
    resumeUrl: { type: String, default: "" },

    // Faculty Profile Fields
    currentCollege: { type: String, default: "" },
    facultyDegree: { type: String, default: "" },
    specialization: { type: String, default: "" },
    university: { type: String, default: "" },
    yearsOfExperience: { type: String, default: "" },
    subjectsTaught: { type: [String], default: [] },
    previousInstitutions: { type: [String], default: [] },
    researchInterests: { type: [String], default: [] },
  },
  { timestamps: true }
);


// 🔐 SAFE PASSWORD HASHING (FIXED)
userSchema.pre("save", async function () {
  try {
    // only hash if password is modified
    if (!this.isModified("password")) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

  } catch (err) {
    console.log("🔥 PASSWORD HASH ERROR:", err);
    throw err;
  }
});


// 🔑 Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);