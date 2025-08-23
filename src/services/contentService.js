const { processEvent } = require('./notificationService');
const { executeQuery } = require('./dbHelpers');

// RENAMED from createPost to createArticle
async function createArticle(actorId, title, content) {
    // UPDATED: Inserts into the 'Articles' table now
    const insertQuery = `INSERT INTO Articles (author_id, title, content) OUTPUT INSERTED.id, INSERTED.title VALUES (${actorId}, '${title.replace(/'/g, "''")}', '${content.replace(/'/g, "''")}');`;
    const result = await executeQuery(insertQuery);
    const newArticle = result[0];

    // UPDATED: Fires a 'NEW_ARTICLE' event for consistency
    await processEvent({
        eventType: 'NEW_ARTICLE',
        actorId: actorId,
        articleId: newArticle.id,
        articleTitle: newArticle.title
    });

    return newArticle;
}


async function createComment(actorId, entityId, content) {
    const insertQuery = `INSERT INTO Comments (article_id, author_id, content) OUTPUT INSERTED.id VALUES (${entityId}, ${actorId}, '${content.replace(/'/g, "''")}');`;
    const result = await executeQuery(insertQuery);
    const newComment = result[0];

    // UPDATED: Event now sends entityId for consistency in the event object
    await processEvent({
        eventType: 'NEW_COMMENT',
        actorId: actorId,
        entityId: entityId // This now matches the API request
    });
    
    return newComment;
}

// --- ADDED: The new createJob function ---
async function createJob(actorId, title, companyName, location) {
    const insertQuery = `INSERT INTO Jobs (author_id, title, company_name, location) OUTPUT INSERTED.id, INSERTED.title VALUES (${actorId}, '${title.replace(/'/g, "''")}', '${companyName.replace(/'/g, "''")}', '${location.replace(/'/g, "''")}');`;
    const result = await executeQuery(insertQuery);
    const newJob = result[0];

    // After creating the job, fire the notification event
    await processEvent({
        eventType: 'NEW_JOB',
        actorId: actorId,
        jobId: newJob.id,
        jobTitle: newJob.title
    });

    return newJob; // Return the new job to the API route
}


// --- ADD these two new functions ---
async function getAllArticles() {
    return await executeQuery('SELECT * FROM Articles ORDER BY created_at DESC;');
}

async function getAllJobs() {
    return await executeQuery('SELECT * FROM Jobs ORDER BY created_at DESC;');
}


module.exports = { createArticle, createComment, createJob, getAllArticles, getAllJobs  };