// ============================================================
//  db.js – MySQL connection pool
//  Usage: const db = require('./db')
// ============================================================
 
require('dotenv').config()
const mysql = require('mysql2/promise')
 
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'task_manager',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
})
 
// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log('✅  Connected to MySQL database:', process.env.DB_NAME || 'task_manager')
    conn.release()
  })
  .catch(err => {
    console.error('❌  Database connection failed:', err.message)
    process.exit(1)
  })
 
module.exports = pool