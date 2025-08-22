const { getConnection, Request } = require('../config/db');
const { getUserById } = require('./userService');

// A helper function to make our query code cleaner
function executeQuery(sql) {
  return new Promise((resolve, reject) => {
    const connection = getConnection();
    const rows = []; // Always start with an empty array

    const request = new Request(sql, (err, rowCount) => {
      if (err) {
        // If there's any SQL error, reject the promise
        console.error("SQL Error:", err.message);
        return reject(err);
      }
      // When the request is fully complete, resolve with the array of rows we collected.
      // If it was an INSERT/DELETE, the array will be empty, which is fine.
      // If it was a SELECT with no results, the array will be empty, which is also fine.
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

// The main event processor is now much simpler
async function processEvent(event) {
  const { eventType } = event;

  switch (eventType) {
    case 'FOLLOW':
      // We return the result so the API route can send it back to the frontend
      return await toggleFollow(event.actorId, event.recipientId);

    default:
      console.log(`Unknown event type received: ${eventType}`);
      return { status: 'unknown_event' };
  }
}

module.exports = { processEvent };