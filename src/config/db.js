const dotenv = require('dotenv');
const {Pool} = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database:process.env.DB_DATABASE,
    password:process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect().then(client=>{
    console.log("✅ PostgreSQL Connected");
    client.release();
}).catch(err=>{
    console.log("❌ PostgreSQL Connection Error:",err.stack);
});

module.exports={
    query:(text, params)=>pool.query(text, params),
    pool
}
