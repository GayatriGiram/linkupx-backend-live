require('dotenv').config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/authRoutes");
const postRoutes = require("./routes/postRoutes");
const Post = require("./models/post");
const AlumniPost = require("./models/alumnipost");
const upload = require("./middleware/upload");
const cloudinary = require("./config/cloudinary");
const fs = require("fs");

const app = express();
const alumniPostRoutes = require("./routes/alumnipost");
const notificationRoutes = require("./routes/notificationRoutes");

// ==========================================================
// ✅ MIDDLEWARE (CORRECT ORDER)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRoutes);
app.use("/api/alumni-posts", alumniPostRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/posts", postRoutes);

// ==========================================================
// 🔍 HEALTH CHECK (OPTIONAL BUT USEFUL)
app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});

// ==========================================================
// 🔗 SHAREABLE POST PAGE
app.get("/post/:postId", async (req, res) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).send("Invalid post ID");
    }

    let post = await Post.findById(postId)
      .populate("user", "fullName profileImage role")
      .lean();

    let postType = "student";
    if (!post) {
      post = await AlumniPost.findById(postId)
        .populate("user", "fullName profileImage role")
        .lean();
      postType = "alumni";
    }

    if (!post) {
      return res.status(404).send("Post not found");
    }

    const author = post.user?.fullName || post.userSnapshot?.fullName || "Unknown";
    const text = post.text || "";
    const media = Array.isArray(post.media) ? post.media : [];
    const imageUrl = media.length > 0 ? media[0].url : null;
    const createdAt = new Date(post.createdAt || post.createdAt).toLocaleString();

    res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LinkUpX Post</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f4f7fb; }
    .card { max-width: 720px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.08); }
    .author { color: #333; margin-bottom: 8px; font-size: 16px; }
    .title { margin: 0; font-size: 28px; color: #111; }
    .meta { color: #666; margin-bottom: 16px; }
    .post-text { margin-bottom: 16px; line-height: 1.7; color: #2d2d2d; }
    .post-image { width: 100%; border-radius: 12px; height: auto; object-fit: cover; }
    .footer { margin-top: 20px; color: #555; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <p class="author">${postType === "alumni" ? "Alumni" : "Poster"}: <strong>${author}</strong></p>
    <h1 class="title">LinkUpX Post</h1>
    <p class="meta">Posted on ${createdAt}</p>
    <div class="post-text">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />")}</div>
    ${imageUrl ? `<img class="post-image" src="${imageUrl}" alt="Post image" />` : ""}
    <div class="footer">Open the LinkUpX app to interact with this post.</div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error("🔥 SHAREABLE POST PAGE ERROR:", err);
    res.status(500).send("Unable to load post");
  }
});

// ==========================================================
// ❌ GLOBAL ERROR HANDLER (VERY IMPORTANT)
app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL ERROR:", err);

  res.status(500).json({
    success: false,
    message: "Something went wrong",
    error: err.message,
  });
});

// ==========================================================
// 🛢️ DB CONNECT + SERVER START
const mongoURI = process.env.MONGO_URI || "mongodb+srv://giramgayatri_db_user:Gayatri%4012345@cluster0.ydbtc62.mongodb.net/?appName=Cluster0";
mongoose.connect(mongoURI)
.then(() => {
  console.log("🟢 MongoDB Connected");

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  });
})
.catch(err => {
  console.error("🔴 MongoDB Error:", err);
});