const Notification = require("../models/Notification");
const User = require("../models/User");

/** Unique ids from followers + following (people in the poster's network). */
function getNetworkRecipientIds(user) {
  const ids = new Set();
  for (const id of user.followers || []) {
    ids.add(id.toString());
  }
  for (const id of user.following || []) {
    ids.add(id.toString());
  }
  ids.delete(user._id.toString());
  return [...ids];
}

function buildNewPostMessage(fullName, text, postType) {
  const preview = text && text.trim()
    ? (text.length > 80 ? `${text.substring(0, 80)}...` : text)
    : "a new update";
  const prefix = postType && postType !== "post"
    ? `${fullName} posted a new ${postType}`
    : `${fullName} posted`;
  return `${prefix}\nAbout: ${preview}`;
}

async function createNewPostNotifications({ poster, postId, text, postType }) {
  const recipientIds = getNetworkRecipientIds(poster);
  if (recipientIds.length === 0) return;

  const message = buildNewPostMessage(poster.fullName, text, postType);
  const notifications = recipientIds.map((receiverId) => ({
    receiver: receiverId,
    sender: poster._id,
    type: "new_post",
    message,
    postId,
  }));

  await Notification.insertMany(notifications);
}

async function createPostEngagementNotification({ post, senderId, type }) {
  const ownerId = post.user?.toString?.() || post.user?.toString();
  if (!ownerId || ownerId === senderId.toString()) return;

  const sender = await User.findById(senderId).select("fullName");
  if (!sender) return;

  const message =
    type === "post_like"
      ? `${sender.fullName} liked your post.`
      : `${sender.fullName} commented on your post.`;

  await Notification.create({
    receiver: ownerId,
    sender: senderId,
    type,
    message,
    postId: post._id,
  });
}

module.exports = {
  getNetworkRecipientIds,
  buildNewPostMessage,
  createNewPostNotifications,
  createPostEngagementNotification,
};
