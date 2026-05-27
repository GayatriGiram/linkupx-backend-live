const mongoose = require("mongoose");
const Post = require("./models/post");

mongoose.connect("mongodb+srv://linkupx:linkupx@cluster0.hftpe3e.mongodb.net/Linkupx?retryWrites=true&w=majority")
  .then(async () => {
    console.log("Connected to MongoDB.");
    
    // Fetch one post that has comments
    const post = await Post.findOne({ "comments.0": { $exists: true } })
      .populate({
        path: "comments.user",
        select: "fullName profileImage role",
      })
      .lean();
      
    if (post) {
      console.log("Post comments array:");
      console.log(JSON.stringify(post.comments, null, 2));
    } else {
      console.log("No posts with comments found.");
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
