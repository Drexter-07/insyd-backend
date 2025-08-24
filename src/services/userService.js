const { executeQuery } = require('./dbHelpers');

/**
 * Gets all users.
 * If a 'currentUserId' is provided in filters, it returns a "smart" list
 * with a dynamic 'isFollowing' field for that user.
 * If not, it returns a "simple" list of all users for selection screens.
 * @param {object} filters - An object from req.query.
 * @returns {Promise<Array>} A promise that resolves to an array of user objects.
 */
async function getAllUsers(filters = {}) {
    const { currentUserId } = filters;

    if (currentUserId) {
        // --- "SMART" MODE: A user is logged in ---
        // This query is for the recommendation panel and needs to know who is asking.
        const query = `
            SELECT
                u.id, u.name, u.email, u.job_role, u.specialization, u.city, u.company_name,
                CASE WHEN f.follower_id IS NOT NULL THEN 1 ELSE 0 END AS isFollowing
            FROM Users u
            LEFT JOIN Follows f ON u.id = f.following_id AND f.follower_id = @currentUserId
            WHERE u.id != @currentUserId;
        `;
        const params = { currentUserId };
        const users = await executeQuery(query, params);

        // Convert 1/0 from SQL to true/false for React
        return users.map(user => ({
            ...user,
            isFollowing: Boolean(user.isFollowing)
        }));

    } else {
        // --- "SIMPLE" MODE: No user is logged in (e.g., the user selection page) ---
        // This query just gets all users without any context.
        const query = 'SELECT id, name, email, job_role, specialization, city, company_name FROM Users';
        return await executeQuery(query, {});
    }
}

async function getUserById(userId) {
    const query = 'SELECT * FROM Users WHERE id = @userId';
    const params = { userId };
    const users = await executeQuery(query, params);
    return users[0];
}

module.exports = {
    getAllUsers,
    getUserById
};
