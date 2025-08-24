const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10),
    pool: {
        max: 10, // Max number of connections
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: true, // Use true for Azure SQL, or if your SQL Server requires it
        trustServerCertificate: true // Use true for local development
    }
};

// Create a single, shared pool promise
const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Successfully connected to the database.');
        return pool;
    })
    .catch(err => {
        console.error('Database Connection Failed! Check your configuration.', err);
        // Exit the process if the DB connection fails, as the app is useless without it
        process.exit(1); 
    });

module.exports = {
    sql,
    poolPromise
};