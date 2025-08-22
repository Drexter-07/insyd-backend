const { getConnection, Request } = require('../config/db');
const { getUserById } = require('./userService');

// A helper function to make our query code cleaner
// Helper to execute any SQL query
// This is the new, robust helper function that always returns an array
function executeQuery(sql) {
  return new Promise((resolve, reject) => {
    const connection = getConnection();
    const rows = []; // Always start with an empty array

    const request = new Request(sql, (err, rowCount) => {
      if (err) {
        console.error("SQL Error:", err.message);
        return reject(err);
      }
      // When the request is fully complete, resolve with the array of rows we collected.
      // For a SELECT, it contains the results.
      // For an INSERT...OUTPUT, it contains the output.
      // For a simple INSERT/DELETE, it's a safe empty array.
      resolve(rows);
    });

    request.on('row', (columns) => {
      const row = {};
      columns.forEach((column) => {
        row[column.metadata.colName] = column.value;
      });
      rows.push(row);
    });

    connection.execSql(request);
  });
}


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

async function createPostNotifications(actorId, postId, postTitle) {
  const actor = await getUserById(actorId);
  // 1. Get all followers of the post's author
  const followers = await executeQuery(`SELECT follower_id FROM Follows WHERE following_id = ${actorId};`);

  if (followers.length === 0) {
    console.log(`Actor ${actorId} has no followers. No notifications to create for NEW_POST.`);
    return;
  }

  // 2. Create a notification for each follower
  // To prevent sending a huge number of notifications at once (the "thundering herd" problem),
  // let's just notify the first 5 followers for this POC. This is a good scalability point to discuss.
  const content = `${actor.name} published a new article: "${postTitle}"`;
  const followersToNotify = followers.slice(0, 5);

  for (const follower of followersToNotify) {
    // We use .replace(/'/g, "''") to escape single quotes in the title to prevent SQL errors
    await executeQuery(
      `INSERT INTO Notifications (recipient_id, actor_id, event_type, entity_id, entity_type, content)
       VALUES (${follower.follower_id}, ${actorId}, 'NEW_POST', ${postId}, 'post', '${content.replace(/'/g, "''")}');`
    );
  }
  console.log(`Created ${followersToNotify.length} notifications for new post ${postId}.`);
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
async function createCommentNotification(actorId, postId) {
    const commenter = await getUserById(actorId);
    const postResult = await executeQuery(`SELECT author_id, title FROM Posts WHERE id = ${postId};`);
    if (postResult.length === 0) throw new Error(`Post with ID ${postId} not found.`);
    const post = postResult[0];
    
    // Do not notify users if they comment on their own post
    if (actorId === post.author_id) return;

    // Create the notification for the post's author
    const content = `${commenter.name} commented on your post: "${post.title}"`;
    await executeQuery(
        `INSERT INTO Notifications (recipient_id, actor_id, event_type, entity_id, entity_type, content)
         VALUES (${post.author_id}, ${actorId}, 'NEW_COMMENT', ${postId}, 'post', '${content.replace(/'/g, "''")}');`
    );
    console.log(`Created NEW_COMMENT notification for post author ${post.author_id}.`);
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
        // This part is for liking comments, which you can test later
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



// The FINAL processEvent ENGINE
async function processEvent(event) {
    console.log("--- processEvent was called with: ---", event);
    const { eventType } = event;
    console.log(`Processing event: ${eventType}`);

    switch (eventType) {
        case 'FOLLOW':
            return await toggleFollow(event.actorId, event.recipientId);

        case 'NEW_POST':
            // This logic is now in contentService.js, so we just create the notification
            await createPostNotifications(event.actorId, event.postId, event.postTitle);
            return { status: 'post_notifications_created' };

        case 'NEW_COMMENT':
            await createCommentNotification(event.actorId, event.postId);
            return { status: 'comment_notification_created' };

        case 'NEW_LIKE':
             try {
                // This will fail if the like already exists, triggering the catch block
                await executeQuery(`INSERT INTO Likes (user_id, entity_id, entity_type) VALUES (${event.actorId}, ${event.entityId}, '${event.entityType}');`);
                await createLikeNotification(event.actorId, event.entityId, event.entityType);
                return { status: 'liked' };
             } catch (error) {
                // This is the "unlike" logic
                console.log('Duplicate like detected, processing as UNLIKE.');
                await executeQuery(`DELETE FROM Likes WHERE user_id = ${event.actorId} AND entity_id = ${event.entityId} AND entity_type = '${event.entityType}';`);
                
                // Also delete the original "like" notification
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