const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    database: process.env.DB_DATABASE || 'website_admin',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

// Add connection test
pool.on('connect', () => {
    console.log('✅ PostgreSQL Connected');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL Error:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
