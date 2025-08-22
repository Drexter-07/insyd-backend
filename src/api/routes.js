const express = require('express');
const router = express.Router();

// Import from all three of our service files
const { getAllUsers } = require('../services/userService');
const { processEvent, getNotificationsForUser } = require('../services/notificationService');
const { createPost, createComment } = require('../services/contentService');

// --- User Route ---
router.get('/users', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// --- Notification Route ---
router.get('/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await getNotificationsForUser(userId);
    res.status(200).json(notifications);
  } catch (error) {
    console.error(`Error fetching notifications for user ${req.params.userId}:`, error);
    res.status(500).json({ message: 'Failed to fetch notifications.' });
  }
});

// --- Content Creation Routes ---
router.post('/posts', async (req, res) => {
  try {
    const { actorId, title, content } = req.body;
    const newPost = await createPost(actorId, title, content || '');
    res.status(201).json(newPost);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: 'Failed to create post.' });
  }
});

router.post('/comments', async (req, res) => {
    try {
        const { actorId, entityId, content } = req.body;
        const newComment = await createComment(actorId, entityId, content);
        res.status(201).json(newComment);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ message: 'Failed to create comment.' });
    }
});

// --- Generic Event Route (for Follows and Likes) ---
router.post('/events', async (req, res) => {
  try {
    const result = await processEvent(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error processing event:', error);
    res.status(500).json({ message: 'Failed to process event.' });
  }
});

module.exports = router;