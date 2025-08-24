const { processEvent } = require("./notificationService");
const { executeQuery } = require("./dbHelpers");

// --- CREATE FUNCTIONS (NOW SECURE) ---

async function createArticle(actorId, title, content) {
  const query = `
    INSERT INTO Articles (author_id, title, content) 
    OUTPUT INSERTED.id, INSERTED.title 
    VALUES (@actorId, @title, @content);
  `;
  const params = { actorId, title, content };
  const result = await executeQuery(query, params);
  const newArticle = result[0];

  await processEvent({
    eventType: "NEW_ARTICLE",
    actorId: actorId,
    articleId: newArticle.id,
    articleTitle: newArticle.title,
  });

  return newArticle;
}

async function createComment(actorId, entityId, content) {
  const query = `
    INSERT INTO Comments (article_id, author_id, content) 
    OUTPUT INSERTED.id 
    VALUES (@entityId, @actorId, @content);
  `;
  const params = { entityId, actorId, content };
  const result = await executeQuery(query, params);
  const newComment = result[0];

  await processEvent({
    eventType: "NEW_COMMENT",
    actorId: actorId,
    entityId: entityId,
  });

  return newComment;
}

async function createJob(actorId, title, companyName, location) {
  const query = `
    INSERT INTO Jobs (author_id, title, company_name, location) 
    OUTPUT INSERTED.id, INSERTED.title 
    VALUES (@actorId, @title, @companyName, @location);
  `;
  const params = { actorId, title, companyName, location };
  const result = await executeQuery(query, params);
  const newJob = result[0];

  await processEvent({
    eventType: "NEW_JOB",
    actorId: actorId,
    jobId: newJob.id,
    jobTitle: newJob.title,
  });

  return newJob;
}

// --- READ FUNCTIONS (NOW SECURE) ---

async function getAllArticles(filters = {}) {
    const { authorId, currentUserId } = filters;

    // --- STEP 1: A simple, query to get all articles. ---
    let articlesQuery = `
        SELECT
            a.id, a.title, a.content, a.created_at,
            u.name AS author_name, u.job_role AS author_job_role
        FROM Articles a
        LEFT JOIN Users u ON a.author_id = u.id
        ${authorId ? 'WHERE a.author_id = @authorId' : ''}
        ORDER BY a.created_at DESC;
    `;
    const articles = await executeQuery(articlesQuery, { authorId });

    if (articles.length === 0) {
        return []; // No articles, no need to check for likes.
    }

    // --- STEP 2: Get all likes for the fetched articles in a single, efficient query. ---
    const articleIds = articles.map(a => a.id);
    const likesQuery = `
        SELECT 
            entity_id, 
            COUNT(*) as likeCount,
            -- Check if the current user is among those who liked the post
            MAX(CASE WHEN user_id = @currentUserId THEN 1 ELSE 0 END) as isLikedByCurrentUser
        FROM Likes
        WHERE entity_type = 'post' AND entity_id IN (${articleIds.join(',')})
        GROUP BY entity_id;
    `;
    const likesData = await executeQuery(likesQuery, { currentUserId });

    // Create a simple map for easy lookup: { articleId -> likeInfo }
    const likesMap = new Map(likesData.map(like => [like.entity_id, like]));

    // --- STEP 3: Merge the two datasets in JavaScript. ---
    return articles.map(article => {
        const likeInfo = likesMap.get(article.id);
        return {
            ...article,
            likeCount: likeInfo ? Number(likeInfo.likeCount) : 0,
            isLikedByCurrentUser: likeInfo ? Boolean(likeInfo.isLikedByCurrentUser) : false,
        };
    });
}

async function getAllJobs(filters = {}) {
  let query = `
    SELECT 
      Jobs.id, Jobs.title, Jobs.company_name, Jobs.location, Jobs.created_at,
      Users.name AS author_name, Users.job_role AS author_job_role 
    FROM Jobs
    LEFT JOIN Users ON Jobs.author_id = Users.id
  `;
  const params = {};

  if (filters.authorId) {
    query += ` WHERE Jobs.author_id = @authorId`;
    params.authorId = filters.authorId;
  }

  query += ` ORDER BY Jobs.created_at DESC;`;

  return await executeQuery(query, params);
}

// --- FEED FUNCTIONS (NOW MORE EFFICIENT) ---
//
const getCombinedFeed = async (filters = {}) => {
  try {
    const { currentUserId } = filters;

    // Pass the filters object down to the data fetching functions
    const [articles, jobs] = await Promise.all([
      getAllArticles({ currentUserId }),
      getAllJobs({ currentUserId }),
    ]);

    const articlesWithMeta = articles.map((item) => ({
      ...item,
      type: "article",
    }));
    const jobsWithMeta = jobs.map((item) => ({ ...item, type: "job" }));

    const combinedFeed = [...articlesWithMeta, ...jobsWithMeta];
    combinedFeed.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    return combinedFeed;
  } catch (error) {
    console.error("Error in getCombinedFeed:", error);
    throw error;
  }
};

const getCombinedFeedByAuthorId = async (authorId, currentUserId) => {
  try {
    const filters = { authorId, currentUserId };

    const [articles, jobs] = await Promise.all([
      getAllArticles(filters),
      getAllJobs(filters),
    ]);

    const articlesWithMeta = articles.map((item) => ({
      ...item,
      type: "article",
    }));
    const jobsWithMeta = jobs.map((item) => ({ ...item, type: "job" }));

    const combinedFeed = [...articlesWithMeta, ...jobsWithMeta];
    combinedFeed.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    return combinedFeed;
  } catch (error) {
    console.error(
      `Error in getCombinedFeedByAuthorId for user ${authorId}:`,
      error
    );
    throw error;
  }
};

async function getCommentsForArticle(articleId, currentUserId) {
    const query = `
        SELECT
            c.id, c.content, c.created_at,
            u.name AS author_name, u.job_role AS author_job_role,
            (SELECT COUNT(*) FROM Likes WHERE entity_id = c.id AND entity_type = 'comment') AS likeCount,
            CAST(CASE WHEN EXISTS (SELECT 1 FROM Likes WHERE entity_id = c.id AND entity_type = 'comment' AND user_id = @currentUserId)
                THEN 1
                ELSE 0
            END AS BIT) AS isLikedByCurrentUser
        FROM
            Comments c
        LEFT JOIN
            Users u ON c.author_id = u.id
        WHERE
            c.article_id = @articleId
        ORDER BY
            c.created_at ASC;
    `;
    const params = { articleId, currentUserId };
    const comments = await executeQuery(query, params);

    return comments.map(comment => ({
        ...comment,
        likeCount: Number(comment.likeCount),
        isLikedByCurrentUser: Boolean(comment.isLikedByCurrentUser)
    }));
}


module.exports = {
  createArticle,
  createComment,
  createJob,
  getAllArticles,
  getAllJobs,
  getCombinedFeed,
  getCombinedFeedByAuthorId,
  getCommentsForArticle,
};
