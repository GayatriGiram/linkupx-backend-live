const express = require("express");
const router = express.Router();

const mongoose = require("mongoose"); // ✅ REQUIRED
const Post = require("../models/post");

const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");


const User = require("../models/User");
const AlumniPost = require("../models/alumnipost");
const Notification = require("../models/Notification");
const {
  createNewPostNotifications,
  createPostEngagementNotification,
} = require("../utils/notificationHelper");

// ==========================================================
// 🔥 GET POSTS (WITH USER DATA)
router.get("/getstudentposts", async (req, res) => {
  try {
    const userId = req.query.userId;

    let posts = await Post.find({ 
      "userSnapshot.role": { $ne: "faculty" } 
    })
      .populate({
        path: "user",
        select: "fullName profileImage role",
      })
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
        const isSaved = Array.isArray(post.saves)
          ? post.saves.some((save) => save.user?.toString() === userId)
          : false;
        
        const authorId = post.user?._id?.toString() || post.user?.toString();
        const isFollowingAuthor = followingList.includes(authorId);

        return {
          ...post,
          isSaved,
          isFollowingAuthor,
        };
      });
    }

    return res.status(200).json({
      success: true,
      posts,
    });

  } catch (error) {
    console.error("🔥 FETCH POSTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch posts",
    });
  }
});

// ==========================================================
// 🎓 GET FACULTY EVENTS
router.get("/getfacultyevents", async (req, res) => {
  try {
    const userId = req.query.userId;

    let posts = await Post.find({ 
      "userSnapshot.role": "faculty"
    })
      .populate({
        path: "user",
        select: "fullName profileImage role",
      })
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
        const isSaved = Array.isArray(post.saves)
          ? post.saves.some((save) => save.user?.toString() === userId)
          : false;

        const isLiked = Array.isArray(post.likes)
          ? post.likes.some((id) => id.toString() === userId)
          : false;
        
        const authorId = post.user?._id?.toString() || post.user?.toString();
        const isFollowingAuthor = followingList.includes(authorId);

        return {
          ...post,
          isSaved,
          isLiked,
          isFollowingAuthor,
        };
      });
    }

    return res.status(200).json({
      success: true,
      posts,
    });

  } catch (error) {
    console.error("🔥 FETCH FACULTY EVENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch faculty events",
    });
  }
});

// 🔥 GET NETWORK POSTS (FOLLOWED USERS)
router.get("/getnetworkposts", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "userId required" });

    const user = await User.findById(userId).select("following");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const followingIds = user.following || [];

    // Fetch from both collections
    const studentFacultyPosts = await Post.find({ user: { $in: followingIds } })
      .populate("user", "fullName profileImage role")
      .populate({
        path: "comments.user",
        select: "fullName profileImage role",
      })
      .sort({ createdAt: -1 })
      .lean();

    const alumniPosts = await AlumniPost.find({ user: { $in: followingIds } })
      .populate("user", "fullName profileImage role")
      .populate({
        path: "comments.user",
        select: "fullName profileImage role",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Combine and sort
    let allPosts = [...studentFacultyPosts, ...alumniPosts].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Map status
    allPosts = allPosts.map(post => {
      const likes = post.likes || [];
      const saves = post.saves || [];
      const authorId = post.user?._id?.toString() || post.userSnapshot?._id?.toString();

      return {
        ...post,
        isLiked: likes.map(id => id.toString()).includes(userId),
        isSaved: saves.some(s => (s.user || s).toString() === userId),
        isFollowingAuthor: true 
      };
    });

    res.status(200).json({ success: true, posts: allPosts });
  } catch (error) {
    console.error("🔥 NETWORK POSTS ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// ==========================================================
// 🚀 CREATE POST (FINAL CLEAN VERSION)
router.post("/create", upload.single("image"), async (req, res) => {
  try {
    const { userId, text, audience } = req.body;
    const brandPartnership = req.body.brandPartnership === "true";

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    let media = [];
    if (req.file) {
      media.push({
        url: req.file.path, // multer-storage-cloudinary puts the URL in path
        public_id: req.file.filename,
        type: "image",
      });
    }

    const postType = req.body.postType || "post";

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (postType === "event") {
      if (user.role !== "faculty") {
        return res.status(403).json({ success: false, message: "Only faculty can post events" });
      }
    } else if (postType === "post") {
      if (user.role !== "student") {
        return res.status(403).json({ success: false, message: "Only students can post here" });
      }
    }

    const newPost = new Post({
      user: user._id,
      userSnapshot: {
        _id: user._id,
        fullName: user.fullName,
        profileImage: user.profileImage || "",
        role: user.role,
      },
      text: text || "",
      media,
      visibility: (audience === "Anyone" || !audience) ? "public" : audience,
      brandPartnership,
      postType,
      likes: [],
      comments: [],
    });

    await newPost.save();

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

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: newPost,
    });
  } catch (error) {
    console.error("🔥 SERVER ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});
// ❤️ LIKE / UNLIKE POST
router.put("/like/:postId", async (req, res) => {
  try {
    const { userId } = req.body;
    const { postId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId required",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const alreadyLiked = post.likes.includes(userId);

    if (alreadyLiked) {
      // ❌ UNLIKE
      post.likes.pull(userId);
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      // ✅ LIKE
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
      } catch (err) {
        console.error("🔥 LIKE NOTIFICATION ERROR:", err);
      }
    }

    return res.status(200).json({
      success: true,
      liked: !alreadyLiked,
      likesCount: post.likesCount,
    });

  } catch (error) {
    console.error("🔥 LIKE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Error liking post",
    });
  }
});

router.post("/save/:postId", async (req, res) => {
  try {
    const { userId } = req.body;
    const { postId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId required",
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const alreadySaved = Array.isArray(post.saves)
      ? post.saves.some((s) => s.user.toString() === userId)
      : false;

    if (alreadySaved) {
      post.saves = post.saves.filter((s) => s.user.toString() !== userId);
      post.savesCount = Math.max(0, post.savesCount - 1);
    } else {
      post.saves.push({ user: userObjectId });
      post.savesCount += 1;
    }

    await post.save();

    return res.status(200).json({
      success: true,
      saved: !alreadySaved,
      savesCount: post.savesCount,
    });
  } catch (error) {
    console.error("🔥 SAVE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error saving post",
      error: error.message,
    });
  }
});

// ==========================================================
// 📌 GET SAVED POSTS
router.get("/saved/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId required",
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const posts = await Post.find({ "saves.user": userObjectId })
      .populate({
        path: "user",
        select: "fullName profileImage role",
      })
      .populate({
        path: "comments.user",
        select: "fullName profileImage role",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Mark as saved for consistency
    const savedPosts = posts.map((post) => ({
      ...post,
      isSaved: true,
    }));

    return res.status(200).json({
      success: true,
      posts: savedPosts,
    });

  } catch (error) {
    console.error("🔥 GET SAVED POSTS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching saved posts",
    });
  }
});

// ==========================================================
// 👤 GET USER'S POSTS
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId required",
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    // Fetch from both standard posts and alumni posts
    const studentFacultyPosts = await Post.find({ user: userObjectId })
      .populate({
        path: "user",
        select: "fullName profileImage role",
      })
      .populate({
        path: "comments.user",
        select: "fullName profileImage role",
      })
      .sort({ createdAt: -1 })
      .lean();

    const alumniPosts = await AlumniPost.find({ user: userObjectId })
      .populate({
        path: "user",
        select: "fullName profileImage role",
      })
      .populate({
        path: "comments.user",
        select: "fullName profileImage role",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Combine and sort by date
    const allPosts = [...studentFacultyPosts, ...alumniPosts].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    return res.status(200).json({
      success: true,
      posts: allPosts,
    });

  } catch (error) {
    console.error("🔥 GET USER POSTS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user posts",
    });
  }
});

// 💬 ADD COMMENT
router.post("/comment/:postId", async (req, res) => {
  try {
    const { userId, text } = req.body;
    const { postId } = req.params;

    if (!userId || !text) {
      return res.status(400).json({
        success: false,
        message: "userId and text required",
      });
    }
    console.log("🔥 COMMENT BODY:", req.body);

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const newComment = {
      user: userId,
      text,
      likes: [],
      replies: [],
    };

    post.comments.push(newComment);
    post.commentsCount += 1;

    await post.save();

    try {
      await createPostEngagementNotification({
        post,
        senderId: userId,
        type: "post_comment",
      });
    } catch (err) {
      console.error("🔥 COMMENT NOTIFICATION ERROR:", err);
    }

    return res.status(201).json({
      success: true,
      message: "Comment added",
      commentsCount: post.commentsCount,
    });

  } catch (error) {
    console.error("🔥 COMMENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Error adding comment",
    });
  }
});
router.put("/comment/like/:postId/:commentId", async (req, res) => {
  try {
    const { userId } = req.body;
    const { postId, commentId } = req.params;

    const post = await Post.findById(postId);

    const comment = post.comments.id(commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const alreadyLiked = comment.likes.includes(userId);

    if (alreadyLiked) {
      comment.likes.pull(userId);
    } else {
      comment.likes.push(userId);
    }

    await post.save();

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

module.exports = router;