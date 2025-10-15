const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('../config');

const pool = mysql.createPool({
  ...DB_CONFIG,
  waitForConnections: true,
  connectionLimit: 10,
});

console.log(`Created MySQL connection pool for ${DB_CONFIG.database}`);
module.exports = pool;
