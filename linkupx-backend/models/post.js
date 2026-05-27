const mongoose = require("mongoose");

/**
 * COMMENT REPLY SCHEMA
 */
const replySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

/**
 * COMMENT SCHEMA
 */
const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    replies: [replySchema],
  },
  { timestamps: true }
);

/**
 * MEDIA SCHEMA ✅ (FIXED FLEXIBLE)
 */
const mediaSchema = new mongoose.Schema(
  {
    url: String,
    public_id: String,
    type: {
      type: String,
      default: "image",
    },
  },
  { _id: false } // cleaner
);

/**
 * POST SCHEMA
 */
const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    userSnapshot: {
      fullName: String,
      profileImage: String,
      role: String,
    },

    text: {
      type: String,
      trim: true,
    },

    // ✅ IMPORTANT: ARRAY OF OBJECTS
    media: [mediaSchema],

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    comments: [commentSchema],

    reposts: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    saves: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    savesCount: {
      type: Number,
      default: 0,
    },

    sends: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        platform: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    repostsCount: { type: Number, default: 0 },
    sendsCount: { type: Number, default: 0 },

    tags: [String],

    visibility: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "public",
    },

    // ✅ ADD THIS (you were using it)
    brandPartnership: {
      type: Boolean,
      default: false,
    },

    postType: {
      type: String,
      enum: ["post", "event"],
      default: "post",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", postSchema);




