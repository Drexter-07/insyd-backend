const express = require("express");
const router = express.Router();

// Import from all three of our service files
const { getAllUsers, getUserById } = require("../services/userService");
const {
  processEvent,
  getNotificationsForUser,
  markNotificationsAsRead,
} = require("../services/notificationService");
const {
  createArticle,
  createComment,
  createJob,
  getAllArticles,
  getAllJobs,
  getCombinedFeed,
  getCombinedFeedByAuthorId,
  getCommentsForArticle,
} = require("../services/contentService");

// --- User Routes ---
// This route now passes the filters to the service
router.get("/users", async (req, res) => {
  try {
    const users = await getAllUsers(req.query); // req.query contains the filters from the URL
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// New route to get a single user
router.get("/users/:userId", async (req, res) => {
  try {
    const user = await getUserById(req.params.userId);
    if (user) {
      res.status(200).json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// --- Content "Read" Routes ---
// NOW ACCEPTS A QUERY PARAMETER, E.G., /articles?authorId=1
router.get("/articles", async (req, res) => {
  try {
    const articles = await getAllArticles(req.query);
    res.status(200).json(articles);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch articles." });
  }
});

// NOW ACCEPTS A QUERY PARAMETER, E.G., /jobs?authorId=1
router.get("/jobs", async (req, res) => {
  try {
    const jobs = await getAllJobs(req.query);
    res.status(200).json(jobs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch jobs." });
  }
});

// --- NEW ROUTE: The combined feed endpoint ---
router.get("/feed", async (req, res) => {
  try {
    // The query parameters (like currentUserId) are available in req.query
    const feed = await getCombinedFeed(req.query);
    res.status(200).json(feed);
  } catch (error) {
    // The service layer logs the specific error, so we can just send a generic message
    res.status(500).json({ message: "Failed to fetch combined feed." });
  }
});

// NEW API ROUTE: Get a combined feed for a single user
router.get("/feed/:userId", async (req, res) => {
  try {
    const { userId } = req.params; // This is the authorId
    const { currentUserId } = req.query; // Get the viewer's ID from the query string
    const feed = await getCombinedFeedByAuthorId(userId, currentUserId);
    res.status(200).json(feed);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user feed." });
  }
});

// --- Notification Route ---
router.get("/notifications/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await getNotificationsForUser(userId);
    res.status(200).json(notifications);
  } catch (error) {
    console.error(
      `Error fetching notifications for user ${req.params.userId}:`,
      error
    );
    res.status(500).json({ message: "Failed to fetch notifications." });
  }
});

// --- CHANGE #2: ADD THIS NEW ROUTE ---
// This route handles the POST request to mark notifications as read
router.post("/notifications/:userId/mark-read", async (req, res) => {
  try {
    const { userId } = req.params;
    await markNotificationsAsRead(userId);
    res.status(200).json({ message: "Notifications marked as read." });
  } catch (error) {
    console.error(
      `Failed to mark notifications as read for user ${req.params.userId}:`,
      error
    );
    res.status(500).json({ message: "Failed to mark notifications as read." });
  }
});

// --- Content Creation Routes ---
router.post("/posts", async (req, res) => {
  try {
    const { actorId, title, content } = req.body;
    const newPost = await createArticle(actorId, title, content || "");
    res.status(201).json(newPost);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ message: "Failed to create post." });
  }
});

// --- ADDED: The new /jobs endpoint ---
router.post("/jobs", async (req, res) => {
  try {
    const { actorId, title, company_name, location } = req.body;
    const newJob = await createJob(actorId, title, company_name, location);
    res.status(201).json(newJob);
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ message: "Failed to create job." });
  }
});
router.post("/comments", async (req, res) => {
  try {
    const { actorId, entityId, content } = req.body;
    const newComment = await createComment(actorId, entityId, content);
    res.status(201).json(newComment);
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ message: "Failed to create comment." });
  }
});
// --- Generic Event Route (for Follows and Likes) ---
router.post("/events", async (req, res) => {
  try {
    const result = await processEvent(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error processing event:", error);
    res.status(500).json({ message: "Failed to process event." });
  }
});

// It handles GET requests to fetch comments for a specific article
router.get("/articles/:articleId/comments", async (req, res) => {
  try {
    const { articleId } = req.params;
    const { currentUserId } = req.query;
    const comments = await getCommentsForArticle(articleId, currentUserId);
    res.status(200).json(comments);
  } catch (error) {
    console.error(
      `Failed to fetch comments for article ${req.params.articleId}:`,
      error
    );
    res.status(500).json({ message: "Failed to fetch comments." });
  }
});

module.exports = router;
