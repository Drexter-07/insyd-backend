const { sql, poolPromise } = require('../config/db');

/**
 * Executes a parameterized SQL query.
 * @param {string} text - The SQL query string with @param placeholders.
 * @param {object} [params={}] - An object of parameters to pass to the query.
 * @returns {Promise<Array>} A promise that resolves to an array of result rows.
 */
async function executeQuery(text, params = {}) {
    try {
        const pool = await poolPromise;
        const request = pool.request();

        // Dynamically add parameters to the request
        for (const key in params) {
            // It's good practice to define the type, but mssql can often infer it.
            // For example: request.input(key, sql.Int, params[key]);
            request.input(key, params[key]);
        }

        const result = await request.query(text);
        return result.recordset;
    } catch (error) {
        console.error('SQL error in executeQuery:', error);
        // Re-throw the error to be caught by the service layer
        throw error; 
    }
}

module.exports = { executeQuery };