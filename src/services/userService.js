const { getConnection, Request } = require('../config/db');

function getAllUsers() {
  // We return a Promise so we can use async/await
  return new Promise((resolve, reject) => {
    const connection = getConnection();
    if (!connection) {
      return reject(new Error("Database is not connected."));
    }

    const users = [];
    const request = new Request('SELECT * FROM Users;', (err) => {
      if (err) {
        return reject(err);
      }
      resolve(users);
    });

    // For each row that comes back from the database...
    request.on('row', columns => {
      const user = {};
      // ...loop through its columns and build a user object
      columns.forEach(column => {
        user[column.metadata.colName] = column.value;
      });
      users.push(user);
    });

    connection.execSql(request);
  });
}

function getUserById(userId) {
  return new Promise((resolve, reject) => {
    const connection = getConnection();
    let user;
    const request = new Request(`SELECT * FROM Users WHERE id = ${userId};`, (err) => {
      if (err) {
        return reject(err);
      }
      resolve(user);
    });

    request.on('row', columns => {
      user = {};
      columns.forEach(column => {
        user[column.metadata.colName] = column.value;
      });
    });

    connection.execSql(request);
  });
}

// UPDATE THE EXPORTS
module.exports = { getAllUsers, getUserById };
