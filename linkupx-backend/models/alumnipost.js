const mongoose = require("mongoose");

/**
 * REPLY SCHEMA
 */
const replySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

/**
 * COMMENT SCHEMA
 */
const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    replies: [replySchema],
  },
  { timestamps: true }
);

/**
 * MEDIA SCHEMA
 */
const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    public_id: { type: String, required: true },
    type: { type: String, default: "image" },
  },
  { _id: false }
);

/**
 * JOB DETAILS SCHEMA
 */
const jobDetailsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, default: "" },

    type: {
      type: String,
      enum: ["Internship", "Full-Time", "Part-Time", "Remote"],
      required: true,
    },

    // ✅ MATCH FRONTEND
    salary: { type: String, default: "" },
    stipend: { type: String, default: "" },

    experienceLevel: {
      type: String,
      enum: ["Fresher", "0-1", "1-3", "3+"],
      default: "Fresher",
    },

    skillsRequired: {
      type: [String],
      default: [],
    },

    applyLink: { type: String, default: "" },

    deadline: { type: Date },

    description: { type: String, default: "" },
  },
  { _id: false }
);

/**
 * MAIN POST SCHEMA
 */
const postSchema = new mongoose.Schema(
  {
    // ✅ SAFE USER (no crash if missing)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    userSnapshot: {
      fullName: { type: String, default: "" },
      profileImage: { type: String, default: "" },
      role: { type: String, default: "alumni" },
    },

    text: {
      type: String,
      trim: true,
      default: "",
    },

    // ✅ MEDIA ARRAY
    media: {
      type: [mediaSchema],
      default: [],
    },

    /**
     * POST TYPE
     */
    postType: {
      type: String,
      enum: ["general", "job", "internship"],
      default: "job", // ✅ better for your use case
    },

    /**
     * JOB DETAILS
     */
    jobDetails: {
      type: jobDetailsSchema,
      default: null,
    },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [commentSchema],

    reposts: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    saves: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    // ✅ COUNTERS
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    repostsCount: { type: Number, default: 0 },
    savesCount: { type: Number, default: 0 },

    tags: {
      type: [String],
      default: [],
    },

    visibility: {
      type: String,
      enum: ["Anyone", "friends", "private"],
      default: "Anyone",
    },

    isVerifiedOpportunity: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.AlumniPost ||
  mongoose.model("AlumniPost", postSchema);