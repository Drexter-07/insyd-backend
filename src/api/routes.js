const express = require('express');
const router = express.Router();
const { getAllUsers } = require('../services/userService'); // Import our new function
const { processEvent } = require('../services/notificationService'); // <-- Import

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

module.exports = router;