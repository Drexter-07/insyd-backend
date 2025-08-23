const { getUserById } = require('./userService');
const { executeQuery } = require('./dbHelpers');

// This new function handles the entire follow/unfollow logic
async function toggleFollow(actorId, recipientId) {
    // Step 1: Check if the follow relationship already exists
    const existingFollow = await executeQuery(`SELECT * FROM Follows WHERE follower_id = ${actorId} AND following_id = ${recipientId};`);

    if (existingFollow.length > 0) {
        // --- UNFOLLOW LOGIC ---
        console.log(`Unfollowing: Actor ${actorId} is unfollowing Recipient ${recipientId}`);
        
        // Step 1: Delete the follow relationship
        await executeQuery(`DELETE FROM Follows WHERE follower_id = ${actorId} AND following_id = ${recipientId};`);
        
        // Step 2 (THE FIX): Delete the original follow notification
        await executeQuery(`DELETE FROM Notifications WHERE actor_id = ${actorId} AND recipient_id = ${recipientId} AND event_type = 'FOLLOW';`);
        
        return { status: 'unfollowed' };
    } else {
        // --- FOLLOW LOGIC (This part is already correct) ---
        console.log(`Following: Actor ${actorId} is following Recipient ${recipientId}`);
        const actor = await getUserById(actorId);
        if (!actor) throw new Error(`User with ID ${actorId} not found.`);
        const content = `${actor.name} started following you.`;

        // Insert into the Follows table first
        await executeQuery(`INSERT INTO Follows (follower_id, following_id) VALUES (${actorId}, ${recipientId});`);
        
        // Then, create the notification
        await executeQuery(
            `INSERT INTO Notifications (recipient_id, actor_id, event_type, entity_id, entity_type, content) 
             VALUES (${recipientId}, ${actorId}, 'FOLLOW', ${actorId}, 'user', '${content}');`
        );
        return { status: 'followed' };
    }
}

// --- RENAMED and UPDATED for Articles ---
async function createArticleNotifications(actorId, articleId, articleTitle) {
  const actor = await getUserById(actorId);
  const followers = await executeQuery(`SELECT follower_id FROM Follows WHERE following_id = ${actorId};`);
  if (followers.length === 0) return;

  const content = `${actor.name} published a new article: "${articleTitle}"`;
  for (const follower of followers) {
    await executeQuery(
      `INSERT INTO Notifications (recipient_id, actor_id, event_type, entity_id, entity_type, content)
       VALUES (${follower.follower_id}, ${actorId}, 'NEW_ARTICLE', ${articleId}, 'article', '${content.replace(/'/g, "''")}');`
    );
  }
  console.log(`Created ${followers.length} notifications for new article ${articleId}.`);
}

// --- ADDED: The new createJobNotifications function ---
async function createJobNotifications(actorId, jobId, jobTitle) {
    const actor = await getUserById(actorId);
    const followers = await executeQuery(`SELECT follower_id FROM Follows WHERE following_id = ${actorId};`);
    if (followers.length === 0) return;

    const content = `${actor.name} posted a new job: "${jobTitle}"`;
    for (const follower of followers) {
        await executeQuery(
            `INSERT INTO Notifications (recipient_id, actor_id, event_type, entity_id, entity_type, content)
            VALUES (${follower.follower_id}, ${actorId}, 'NEW_JOB', ${jobId}, 'job', '${content.replace(/'/g, "''")}');`
        );
    }
    console.log(`Created ${followers.length} notifications for new job ${jobId}.`);
}

// Add this new function to get all notifications for a given user
async function getNotificationsForUser(userId) {
  console.log(`Fetching notifications for user ${userId}`);
  const query = `
    SELECT 
      n.id, 
      n.content, 
      n.is_read, 
      n.created_at, 
      n.event_type, 
      n.entity_id, 
      n.entity_type,
      u.name as actor_name
    FROM 
      Notifications as n
    JOIN 
      Users as u ON n.actor_id = u.id
    WHERE 
      n.recipient_id = ${userId}
    ORDER BY 
      n.created_at DESC;
  `;
  const notifications = await executeQuery(query);
  return notifications;
}

// --- FUNCTION for NEW_COMMENT event ---
async function createCommentNotification(actorId, entityId) { 
    const commenter = await getUserById(actorId);
    // We still query the Articles table, because we know this is a comment on an article.
    const articleResult = await executeQuery(`SELECT author_id, title FROM Articles WHERE id = ${entityId};`);
    if (articleResult.length === 0) throw new Error(`Article with ID ${entityId} not found.`);
    const article = articleResult[0];
    
    if (actorId === article.author_id) return;

    const content = `${commenter.name} commented on your article: "${article.title}"`;
    await executeQuery(
        `INSERT INTO Notifications (recipient_id, actor_id, event_type, entity_id, entity_type, content)
         VALUES (${article.author_id}, ${actorId}, 'NEW_COMMENT', ${entityId}, 'article', '${content.replace(/'/g, "''")}');`
    );
    console.log(`Created NEW_COMMENT notification for article author ${article.author_id}.`);
}


// --- FUNCTION for NEW_LIKE event ---
async function createLikeNotification(actorId, entityId, entityType) {
    const actor = await getUserById(actorId);
    let contentAuthorId;
    let contentSnippet;

    if (entityType === 'post') {
        const post = (await executeQuery(`SELECT author_id, title FROM Posts WHERE id = ${entityId};`))[0];
        if (post) {
            contentAuthorId = post.author_id;
            contentSnippet = `your post: "${post.title}"`;
        }
    } else if (entityType === 'comment') {
        // This part is for liking comments, 
        const comment = (await executeQuery(`SELECT author_id, content FROM Comments WHERE id = ${entityId};`))[0];
        if (comment) {
            contentAuthorId = comment.author_id;
            contentSnippet = `your comment: "${comment.content.substring(0, 20)}..."`;
        }
    }

    if (!contentAuthorId) throw new Error(`Content not found.`);
    if (actorId === contentAuthorId) return; // No notification for liking your own content

    const content = `${actor.name} liked ${contentSnippet}`;
    await executeQuery(
        `INSERT INTO Notifications (recipient_id, actor_id, event_type, entity_id, entity_type, content)
         VALUES (${contentAuthorId}, ${actorId}, 'NEW_LIKE', ${entityId}, '${entityType}', '${content.replace(/'/g, "''")}');`
    );
    console.log(`Created NEW_LIKE notification for recipient ${contentAuthorId}.`);
}



// --- The FINAL processEvent ENGINE with all event types ---
async function processEvent(event) {
    const { eventType } = event;
    switch (eventType) {
        case 'FOLLOW':
            return await toggleFollow(event.actorId, event.recipientId);
        
        // UPDATED eventType
        case 'NEW_ARTICLE':
            await createArticleNotifications(event.actorId, event.articleId, event.articleTitle);
            return { status: 'article_notifications_created' };

        // ADDED eventType
        case 'NEW_JOB':
            await createJobNotifications(event.actorId, event.jobId, event.jobTitle);
            return { status: 'job_notifications_created' };

        case 'NEW_COMMENT':
            await createCommentNotification(event.actorId, event.entityId); 
            return { status: 'comment_notification_created' };

        case 'NEW_LIKE':
             try {
                // This will fail if the like already exists, triggering the catch block
                await executeQuery(`INSERT INTO Likes (user_id, entity_id, entity_type) VALUES (${event.actorId}, ${event.entityId}, '${event.entityType}');`);
                await createLikeNotification(event.actorId, event.entityId, event.entityType);
                return { status: 'liked' };
             } catch (error) {
                // This is the "unlike" logic
                await executeQuery(`DELETE FROM Likes WHERE user_id = ${event.actorId} AND entity_id = ${event.entityId} AND entity_type = '${event.entityType}';`);
                await executeQuery(`DELETE FROM Notifications WHERE actor_id = ${event.actorId} AND entity_id = ${event.entityId} AND entity_type = '${event.entityType}' AND event_type = 'NEW_LIKE';`);
                return { status: 'unliked' };
             }

        default:
            return { status: 'unknown_event' };
    }
}

// IMPORTANT: Export all the functions that other files will need
module.exports = { 
    processEvent, 
    getNotificationsForUser,
    executeQuery // Export the helper
};