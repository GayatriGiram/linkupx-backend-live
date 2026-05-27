const mongoose = require("mongoose");
const User = require("./models/User");
const Post = require("./models/post");

mongoose.connect("mongodb://127.0.0.1:27017/linkupx")
  .then(async () => {
    const userObjectId = new mongoose.Types.ObjectId("69f0545f8fe0dad3a8588a46");
    
    const posts1 = await Post.find({ user: userObjectId })
      .populate({
        path: "comments.user",
        select: "fullName profileImage role",
      })
      .lean();
      
    const posts2 = await Post.find({ user: userObjectId })
      .populate("comments.user", "fullName profileImage role")
      .lean();

    for (const p of posts1) {
      if (p.comments && p.comments.length > 0) {
        console.log("posts1 comments:", JSON.stringify(p.comments));
      }
    }
    
    console.log("----------------------");
    
    for (const p of posts2) {
      if (p.comments && p.comments.length > 0) {
        console.log("posts2 comments:", JSON.stringify(p.comments));
      }
    }
    
    process.exit(0);
  });
