const mongoose = require("mongoose");
const User = require("./models/User");
const AlumniPost = require("./models/alumnipost");
const Post = require("./models/post");

mongoose.connect("mongodb://127.0.0.1:27017/linkupx")
  .then(async () => {
    console.log("Connected to local MongoDB.");
    
    const alumniPosts = await AlumniPost.find({ "comments.0": { $exists: true } })
      .populate("comments.user", "fullName profileImage role").lean();
      
    const stdPosts = await Post.find({ "comments.0": { $exists: true } })
      .populate("comments.user", "fullName profileImage role").lean();

    console.log("--- Alumni Posts ---");
    for (const post of alumniPosts) {
      console.log(JSON.stringify(post.comments, null, 2));
    }
    
    console.log("--- Standard Posts ---");
    for (const post of stdPosts) {
      console.log(JSON.stringify(post.comments, null, 2));
    }

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
