const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  database: process.env.DB_DATABASE || 'website_admin',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,

  // Add SSL configuration for remote connections
  ssl: {
    rejectUnauthorized: false
  },

  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increase timeout for remote connections
});

// Enhanced connection test
pool.on('connect', (client) => {
  console.log('✅ PostgreSQL Connected');
  console.log(
    `Connected to: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`
  );
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL Error:', err);
  console.error('Check your database configuration and network connectivity');
});

// Test initial connection
pool
  .connect()
  .then((client) => {
    console.log('✅ Initial database connection successful');
    client.release();
  })
  .catch((err) => {
    console.error('❌ Initial database connection failed:', err.message);
    console.error('Please check your .env file and database server configuration');
  });

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
