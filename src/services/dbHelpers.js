const { getConnection, Request } = require('../config/db');

function executeQuery(sql) {
    return new Promise((resolve, reject) => {
        const connection = getConnection();
        const rows = [];
        const request = new Request(sql, (err, rowCount) => {
            if (err) {
                return reject(err);
            }
            resolve(rows.length > 0 ? rows : []);
        });
        request.on('row', (columns) => {
            const row = {};
            columns.forEach((column) => { row[column.metadata.colName] = column.value; });
            rows.push(row);
        });
        connection.execSql(request);
    });
}

module.exports = { executeQuery };