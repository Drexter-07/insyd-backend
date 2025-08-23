const { executeQuery } = require('./dbHelpers');

// UPDATED: This function now handles filters
async function getAllUsers(filters = {}) {
    let query = 'SELECT id, name, email, job_role, specialization, city, company_name FROM Users WHERE 1=1';

    // Dynamically add filter conditions to the WHERE clause
    if (filters.job_role) {
        query += ` AND job_role = '${filters.job_role.replace(/'/g, "''")}'`;
    }
    if (filters.city) {
        query += ` AND city = '${filters.city.replace(/'/g, "''")}'`;
    }
    if (filters.company_name) {
        query += ` AND company_name = '${filters.company_name.replace(/'/g, "''")}'`;
    }

    return await executeQuery(query);
}

async function getUserById(userId) {
  const result = await executeQuery(`SELECT * FROM Users WHERE id = ${userId};`);
  return result[0];
}

// UPDATE THE EXPORTS
module.exports = { getAllUsers, getUserById };
