const http = require('http');

http.get('http://localhost:5000/api/posts/user/69f0545f8fe0dad3a8588a46', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.posts && json.posts.length > 0) {
      for (const post of json.posts) {
        if (post.comments && post.comments.length > 0) {
          console.log("Post ID:", post._id);
          console.log("Comments:", JSON.stringify(post.comments, null, 2));
        }
      }
    } else {
      console.log("No posts with comments found.");
    }
  });
}).on('error', (err) => {
  console.error("Error: ", err.message);
});
