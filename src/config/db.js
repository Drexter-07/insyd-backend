const { Connection, Request } = require('tedious');

const config = {
  server: process.env.DB_HOST,
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
  },
  options: {
    encrypt: true,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10),
    trustServerCertificate: true,
  },
};

let connection;

function connectDb(retries = 5) {
  return new Promise((resolve, reject) => {
    console.log('Attempting to connect to the database...');
    const newConnection = new Connection(config);

    newConnection.on('connect', (err) => {
      if (err) {
        console.error('Database Connection Failed:', err.message);
        if (retries > 0) {
          console.log(`Retrying connection... (${retries} retries left)`);
          setTimeout(() => {
            connectDb(retries - 1).then(resolve).catch(reject);
          }, 5000);
        } else {
          reject(new Error("Could not connect to the database after multiple retries."));
        }
      } else {
        console.log('Successfully connected to the database.');
        connection = newConnection;
        resolve(connection);
      }
    });

    newConnection.connect();
  });
}

function getConnection() {
    if (!connection) {
        throw new Error("Database not connected.");
    }
    return connection;
}

module.exports = { connectDb, getConnection, Request };