const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");

// Get all notifications for a user
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({ receiver: userId })
      .populate("sender", "fullName profileImage role")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark all as read
router.put("/read-all/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    await Notification.updateMany({ receiver: userId }, { isRead: true });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
