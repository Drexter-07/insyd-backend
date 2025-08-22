const { processEvent, executeQuery } = require('./notificationService');

async function createPost(actorId, title, content) {
    const insertQuery = `INSERT INTO Posts (author_id, title, content) OUTPUT INSERTED.id, INSERTED.title VALUES (${actorId}, '${title.replace(/'/g, "''")}', '${content.replace(/'/g, "''")}');`;
    const result = await executeQuery(insertQuery);
    const newPost = result[0];

    // After creating the post, fire the notification event internally
    await processEvent({
        eventType: 'NEW_POST',
        actorId: actorId,
        postId: newPost.id,
        postTitle: newPost.title
    });

    return newPost;
}

async function createComment(actorId, entityId, content) { // Changed postId to entityId
    const insertQuery = `INSERT INTO Comments (post_id, author_id, content) OUTPUT INSERTED.id VALUES (${entityId}, ${actorId}, '${content.replace(/'/g, "''")}');`;
    const result = await executeQuery(insertQuery);
    const newComment = result[0];

    // After creating the comment, fire the notification event
    await processEvent({
        eventType: 'NEW_COMMENT',
        actorId: actorId,
        postId: entityId // Internally we can still call it postId for clarity
    });
    
    return newComment;
}

module.exports = { createPost, createComment };