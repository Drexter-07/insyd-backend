const { getUserById } = require('./userService');
const { executeQuery } = require('./dbHelpers');

// --- CHANGE #1: Import the new emitToUser function ---
const { emitToUser } = require('../socketManager');

// This new function handles the entire follow/unfollow logic
async function toggleFollow(actorId, recipientId) {
    const checkQuery = 'SELECT * FROM Follows WHERE follower_id = @actorId AND following_id = @recipientId;';
    const existingFollow = await executeQuery(checkQuery, { actorId, recipientId });

    if (existingFollow.length > 0) {
        await executeQuery('DELETE FROM Follows WHERE follower_id = @actorId AND following_id = @recipientId;', { actorId, recipientId });
        await executeQuery(`DELETE FROM Notifications WHERE actor_id = @actorId AND recipient_id = @recipientId AND event_type = 'FOLLOW';`, { actorId, recipientId });
        return { status: 'unfollowed' };
    } else {
        const actor = await getUserById(actorId);
        if (!actor) throw new Error(`User with ID ${actorId} not found.`);
        const content = `${actor.name} started following you.`;
        await executeQuery('INSERT INTO Follows (follower_id, following_id) VALUES (@actorId, @recipientId);', { actorId, recipientId });
        
        const insertNotificationQuery = `
            INSERT INTO Notifications (recipient_id, actor_id, event_type, entity_id, entity_type, content) 
            OUTPUT INSERTED.*
            VALUES (@recipientId, @actorId, 'FOLLOW', @actorId, 'user', @content);
        `;
        const newNotificationResult = await executeQuery(insertNotificationQuery, { recipientId, actorId, content });
        const newNotification = newNotificationResult[0];

        // --- CHANGE #2: Emit the new notification in real-time ---
        if (newNotification) {
            emitToUser(recipientId, 'new_notification', { ...newNotification, actor_name: actor.name });
        }
        return { status: 'followed' };
    }
}

// --- RENAMED and UPDATED for Articles ---
async function createArticleNotifications(actorId, articleId, articleTitle) {
    const actor = await getUserById(actorId);
    const followers = await executeQuery('SELECT follower_id FROM Follows WHERE following_id = @actorId;', { actorId });
    if (followers.length === 0) return;

    const content = `${actor.name} published a new article: "${articleTitle}"`;
    for (const follower of followers) {
        const insertQuery = `
            INSERT INTO Notifications (recipient_id, actor_id, event_type, entity_id, entity_type, content)
            OUTPUT INSERTED.*
            VALUES (@recipientId, @actorId, 'NEW_ARTICLE', @articleId, 'article', @content);
        `;
        const newNotificationResult = await executeQuery(insertQuery, { recipientId: follower.follower_id, actorId, articleId, content });
        const newNotification = newNotificationResult[0];
        
        // --- CHANGE #3: Emit to each follower ---
        if (newNotification) {
            emitToUser(follower.follower_id, 'new_notification', { ...newNotification, actor_name: actor.name });
        }
    }
}

// --- ADDED: The new createJobNotifications function ---
async function createJobNotifications(actorId, jobId, jobTitle) {
    const actor = await getUserById(actorId);
    const followers = await executeQuery('SELECT follower_id FROM Follows WHERE following_id = @actorId;', { actorId });
    if (followers.length === 0) return;

    const content = `${actor.name} posted a new job: "${jobTitle}"`;
    for (const follower of followers) {
        const insertQuery = `
            INSERT INTO Notifications (recipient_id, actor_id, event_type, entity_id, entity_type, content)
            OUTPUT INSERTED.*
            VALUES (@recipientId, @actorId, 'NEW_JOB', @jobId, 'job', @content);
        `;
        const newNotificationResult = await executeQuery(insertQuery, { recipientId: follower.follower_id, actorId, jobId, content });
        const newNotification = newNotificationResult[0];

        // --- CHANGE #4: Emit to each follower ---
        if (newNotification) {
            emitToUser(follower.follower_id, 'new_notification', { ...newNotification, actor_name: actor.name });
        }
    }
}

// Add this new function to get all notifications for a given user
async function getNotificationsForUser(userId) {
    console.log(`Fetching notifications for user ${userId}`);
    const query = `
        SELECT 
            n.id, n.content, n.is_read, n.created_at, n.event_type, 
            n.entity_id, n.entity_type, u.name as actor_name
        FROM Notifications as n
        JOIN Users as u ON n.actor_id = u.id
        WHERE n.recipient_id = @userId
        ORDER BY n.created_at DESC;
    `;
    return await executeQuery(query, { userId });
}

// --- FUNCTION for NEW_COMMENT event ---
async function createCommentNotification(actorId, entityId) { 
    const commenter = await getUserById(actorId);
    const articleResult = await executeQuery('SELECT author_id, title FROM Articles WHERE id = @entityId;', { entityId });
    if (articleResult.length === 0) return;
    const article = articleResult[0];
    
    if (actorId === article.author_id) return;

    const content = `${commenter.name} commented on your article: "${article.title}"`;
    const insertQuery = `
        INSERT INTO Notifications (recipient_id, actor_id, event_type, entity_id, entity_type, content)
        OUTPUT INSERTED.*
        VALUES (@recipientId, @actorId, 'NEW_COMMENT', @entityId, 'article', @content);
    `;
    const newNotificationResult = await executeQuery(insertQuery, { recipientId: article.author_id, actorId, entityId, content });
    const newNotification = newNotificationResult[0];

    // --- CHANGE #5: Emit the new notification in real-time ---
    if (newNotification) {
        emitToUser(article.author_id, 'new_notification', { ...newNotification, actor_name: commenter.name });
    }
}

// --- FUNCTION for NEW_LIKE event ---
async function createLikeNotification(actorId, entityId, entityType) {
    const actor = await getUserById(actorId);
    let contentAuthorId, contentSnippet;

    if (entityType === 'post') {
        const article = (await executeQuery('SELECT author_id, title FROM Articles WHERE id = @entityId;', { entityId }))[0];
        if (article) { contentAuthorId = article.author_id; contentSnippet = `your post: "${article.title}"`; }
    } else if (entityType === 'comment') {
        const comment = (await executeQuery('SELECT author_id, content FROM Comments WHERE id = @entityId;', { entityId }))[0];
        if (comment) { contentAuthorId = comment.author_id; contentSnippet = `your comment: "${comment.content.substring(0, 20)}..."`; }
    }

    if (!contentAuthorId || actorId === contentAuthorId) return;

    const content = `${actor.name} liked ${contentSnippet}`;
    const insertQuery = `
        INSERT INTO Notifications (recipient_id, actor_id, event_type, entity_id, entity_type, content)
        OUTPUT INSERTED.*
        VALUES (@contentAuthorId, @actorId, 'NEW_LIKE', @entityId, @entityType, @content);
    `;
    const newNotificationResult = await executeQuery(insertQuery, { contentAuthorId, actorId, entityId, entityType, content });
    const newNotification = newNotificationResult[0];

    // --- CHANGE #6: Emit the new notification in real-time ---
    if (newNotification) {
        emitToUser(contentAuthorId, 'new_notification', { ...newNotification, actor_name: actor.name });
    }
}


// --- The FINAL processEvent ENGINE with all event types ---
async function processEvent(event) {
    const { eventType } = event;
    switch (eventType) {
        case 'FOLLOW':
            return await toggleFollow(event.actorId, event.recipientId);
        
        case 'NEW_ARTICLE':
            await createArticleNotifications(event.actorId, event.articleId, event.articleTitle);
            return { status: 'article_notifications_created' };

        case 'NEW_JOB':
            await createJobNotifications(event.actorId, event.jobId, event.jobTitle);
            return { status: 'job_notifications_created' };

        case 'NEW_COMMENT':
            await createCommentNotification(event.actorId, event.entityId); 
            return { status: 'comment_notification_created' };
            
        // --- THIS IS THE CORRECTED LOGIC FOR LIKES ---
        case 'NEW_LIKE': {
            const { actorId, entityId, entityType } = event;
            const checkQuery = 'SELECT * FROM Likes WHERE user_id = @actorId AND entity_id = @entityId AND entity_type = @entityType;';
            const existingLike = await executeQuery(checkQuery, { actorId, entityId, entityType });

            if (existingLike.length > 0) {
                // UNLIKE LOGIC
                await executeQuery('DELETE FROM Likes WHERE user_id = @actorId AND entity_id = @entityId AND entity_type = @entityType;', { actorId, entityId, entityType });
                await executeQuery(`DELETE FROM Notifications WHERE actor_id = @actorId AND entity_id = @entityId AND entity_type = @entityType AND event_type = 'NEW_LIKE';`, { actorId, entityId, entityType });
                return { status: 'unliked' };
            } else {
                // LIKE LOGIC
                await executeQuery('INSERT INTO Likes (user_id, entity_id, entity_type) VALUES (@actorId, @entityId, @entityType);', { actorId, entityId, entityType });
                await createLikeNotification(actorId, entityId, entityType);
                return { status: 'liked' };
            }
        }

        default:
            return { status: 'unknown_event' };
    }
}

async function markNotificationsAsRead(userId) {
    const query = `UPDATE Notifications SET is_read = 1 WHERE recipient_id = @userId AND is_read = 0;`;
    await executeQuery(query, { userId });
    console.log(`Marked notifications as read for user ${userId}`);
}

// IMPORTANT: Export all the functions that other files will need
module.exports = { 
    processEvent, 
    getNotificationsForUser,
    markNotificationsAsRead,
};