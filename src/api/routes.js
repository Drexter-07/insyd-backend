const express = require('express');
const router = express.Router();
const { getAllUsers } = require('../services/userService'); // Import our new function
const { processEvent, getNotificationsForUser } = require('../services/notificationService'); // <-- Import
const { createPost, createComment } = require('../services/contentService');

// GET /api/users
router.get('/users', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// POST /api/events (NEW ROUTE)
router.post('/events', async (req, res) => {
  try {
    const result = await processEvent(req.body); // <-- Capture the result
    res.status(200).json(result); // <-- Send the result back to the client
  } catch (error) {
    console.error('Error processing event:', error);
    res.status(500).json({ message: 'Failed to process event.' });
  }
});

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
        const newPost = await createPost(actorId, title, content || ''); // Add default content
        res.status(201).json(newPost);
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ message: 'Failed to create post.' });
    }
});

router.post('/comments', async (req, res) => {
    try {
        const { actorId, entityId, content } = req.body; // Changed postId to entityId
        // For now, we only support commenting on posts
        const newComment = await createComment(actorId, entityId, content);
        res.status(201).json(newComment);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ message: 'Failed to create comment.' });
    }
});

module.exports = router;