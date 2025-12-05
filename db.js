// db.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Railway usa SSL; local precisa disso para não quebrar
  },
});

module.exports = pool;
