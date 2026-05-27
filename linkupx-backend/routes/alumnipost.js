const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const Post = require("../models/alumnipost");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const Notification = require("../models/Notification");
const {
  createNewPostNotifications,
  createPostEngagementNotification,
} = require("../utils/notificationHelper");

/**
 * ONLY FOR ALUMNI JOB POSTS (WITH IMAGE UPLOAD)
 */
// GET ALL POSTS
router.get("/", async (req, res) => {
  try {
    const rawUserId = req.query.userId;
    const userId = rawUserId ? rawUserId.toString().trim() : null;

    let posts = await Post.find()
      .populate("user", "fullName profileImage role")
      .populate({
        path: "comments.user",
        select: "fullName profileImage role",
      })
      .sort({ createdAt: -1 })
      .lean();

    if (userId) {
      const currentUser = await User.findById(userId).select("following");
      const followingList = currentUser ? currentUser.following.map(id => id.toString()) : [];

      posts = posts.map((post) => {
        // Robustly get the author ID
        let authorId = null;
        if (post.user) {
          if (typeof post.user === 'object' && post.user._id) {
            authorId = post.user._id.toString();
          } else {
            authorId = post.user.toString();
          }
        }
        
        const isFollowingAuthor = authorId ? followingList.includes(authorId) : false;
        
        const isSaved = Array.isArray(post.saves)
          ? post.saves.some((s) => s.user?.toString() === userId)
          : false;

        return {
          ...post,
          isFollowingAuthor,
          isSaved,
        };
      });
    }

    res.status(200).json({
      success: true,
      posts,
    });
  } catch (err) {
    console.error("🔥 FETCH ALUMNI POSTS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching posts",
    });
  }
});
router.post(
  "/create",

  // ✅ MUST MATCH FRONTEND FIELD NAME → "media"
  upload.array("media", 5),

  async (req, res) => {
    try {
      console.log("\n📥 ===== NEW REQUEST =====");
      console.log(`📍 ${req.method} ${req.originalUrl}`);

      console.log("🧾 Body:", req.body);

      console.log("🖼 Files:", req.files?.length || 0);

      const { userId, text } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, message: "userId is required" });
      }

      const user = await User.findById(userId);
      if (!user || user.role !== "alumni") {
        console.log("❌ Not alumni");
        return res.status(403).json({
          success: false,
          message: "Only alumni can create posts",
        });
      }

      // ✅ DEFAULT TYPE
      const postType = req.body.postType || "job";

      // ✅ PARSE jobDetails
      let jobDetails = {};
      if (req.body.jobDetails) {
        try {
          jobDetails = JSON.parse(req.body.jobDetails);
        } catch (err) {
          console.log("❌ jobDetails parse failed");
          return res.status(400).json({
            success: false,
            message: "Invalid jobDetails",
          });
        }
      }

      // =========================
      // ☁️ CLOUDINARY UPLOAD
      // =========================
      let media = [];

      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          console.log("⬆️ Uploading:", file.originalname);

          try {
            const result = await cloudinary.uploader.upload(
              file.path, // ✅ IMPORTANT (works with diskStorage)
              {
                folder: "alumni_posts",
              }
            );

            media.push({
              url: result.secure_url,
              public_id: result.public_id,
              type: "image",
            });

            console.log("✅ Uploaded:", result.secure_url);
          } catch (err) {
            console.log("❌ Cloudinary upload failed:", err);
          }
        }
      }

      // =========================
      // 💾 SAVE TO DB
      // =========================
      const newPost = await Post.create({
        user: user._id,

        userSnapshot: {
          fullName: user.fullName,
          profileImage: user.profileImage || "",
          role: user.role,
        },

        text: text,
        postType,
        jobDetails,
        media,
      });

      // 🔔 Notify followers and people the poster follows
      try {
        await createNewPostNotifications({
          poster: user,
          postId: newPost._id,
          text: text || "",
          postType,
        });
      } catch (err) {
        console.error("🔥 NOTIFICATION ERROR:", err);
      }

      console.log("🎉 Post Created:", newPost._id);

      return res.status(201).json({
        success: true,
        post: newPost,
      });

    } catch (error) {
      console.error("🔥 SERVER ERROR:", error);

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.post("/:id/like", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const { userId } = req.body;
    const alreadyLiked = post.likes.includes(userId);

    if (alreadyLiked) {
      post.likes.pull(userId);
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      post.likes.push(userId);
      post.likesCount += 1;
    }

    await post.save();

    if (!alreadyLiked) {
      try {
        await createPostEngagementNotification({
          post,
          senderId: userId,
          type: "post_like",
        });
      } catch (notifyErr) {
        console.error("🔥 ALUMNI LIKE NOTIFICATION ERROR:", notifyErr);
      }
    }

    res.json({
      success: true,
      liked: !alreadyLiked,
      likesCount: post.likesCount,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/comment", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }

    const post = await Post.findById(req.params.id);

    const newComment = {
      user: req.body.userId,
      text,
    };

    post.comments.push(newComment);
    post.commentsCount += 1;

    await post.save();

    try {
      await createPostEngagementNotification({
        post,
        senderId: req.body.userId,
        type: "post_comment",
      });
    } catch (notifyErr) {
      console.error("🔥 ALUMNI COMMENT NOTIFICATION ERROR:", notifyErr);
    }

    res.json({
      success: true,
      comment: newComment,
      commentsCount: post.commentsCount,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.delete("/:postId/comment/:commentId", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    comment.remove();
    post.commentsCount = Math.max(0, post.commentsCount - 1);

    await post.save();

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:postId/comment/:commentId/like", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    const comment = post.comments.id(req.params.commentId);

    const alreadyLiked = comment.likes.includes(req.body.userId);

    if (alreadyLiked) {
      comment.likes.pull(req.body.userId);
    } else {
      comment.likes.push(req.body.userId);
    }

    await post.save();

    res.json({
      success: true,
      liked: !alreadyLiked,
      likesCount: comment.likes.length,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/repost", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    const alreadyReposted = post.reposts.some(
      (r) => r.user.toString() === req.body.userId
    );

    if (alreadyReposted) {
      return res.json({ message: "Already reposted" });
    }

    post.reposts.push({ user: req.body.userId });
    post.repostsCount += 1;

    await post.save();

    res.json({
      success: true,
      repostsCount: post.repostsCount,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:id/save", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    const alreadySaved = post.saves.some(
      (s) => s.user.toString() === req.body.userId
    );

    if (alreadySaved) {
      post.saves = post.saves.filter(
        (s) => s.user.toString() !== req.body.userId
      );
      post.savesCount = Math.max(0, post.savesCount - 1);
    } else {
      post.saves.push({ user: req.body.userId });
      post.savesCount += 1;
    }

    await post.save();

    res.json({
      success: true,
      saved: !alreadySaved,
      savesCount: post.savesCount,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:postId/comment/:commentId/reply", async (req, res) => {
  try {
    const { text } = req.body;

    const post = await Post.findById(req.params.postId);
    const comment = post.comments.id(req.params.commentId);

    const reply = {
      user: req.body.userId,
      text,
    };

    comment.replies.push(reply);

    await post.save();

    res.json({ success: true, reply });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET SAVED POSTS
router.get("/saved/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId required" });
    }

    const posts = await Post.find({ "saves.user": userId })
      .populate("user", "fullName profileImage role")
      .populate({
        path: "comments.user",
        select: "fullName profileImage role",
      })
      .sort({ createdAt: -1 })
      .lean();

    const savedPosts = posts.map(post => ({
      ...post,
      isSaved: true
    }));

    res.status(200).json({ success: true, posts: savedPosts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;