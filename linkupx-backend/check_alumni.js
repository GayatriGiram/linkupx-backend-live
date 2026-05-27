const mongoose = require("mongoose");
const User = require("./models/User");
const AlumniPost = require("./models/alumnipost");

mongoose.connect("mongodb://127.0.0.1:27017/linkupx")
  .then(async () => {
    console.log("Connected to local MongoDB.");
    
    // Fetch alumni posts that have comments
    const posts = await AlumniPost.find({ "comments.0": { $exists: true } })
      .populate({
        path: "comments.user",
        select: "fullName profileImage role",
      })
      .lean();
      
    if (posts && posts.length > 0) {
      console.log("Found posts with comments:");
      for (const post of posts) {
         console.log("Post ID:", post._id);
         console.log(JSON.stringify(post.comments, null, 2));
      }
    } else {
      console.log("No alumni posts with comments found.");
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
