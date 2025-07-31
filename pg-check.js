const { Client } = require('pg');
require('dotenv').config();

// Quick test with your PostgreSQL credentials
async function quickPostgresTest() {
    console.log('🚀 Quick PostgreSQL Connection Test');
    console.log('===================================');

    // You need to provide the actual password
    const password = process.env.DB_PASSWORD || 'REPLACE_WITH_ACTUAL_PASSWORD';

    if (password === 'REPLACE_WITH_ACTUAL_PASSWORD') {
        console.log('❌ Please update the password in this script or set DB_PASSWORD environment variable');
        return;
    }

    const client = new Client({
        host: 'postgres-main-db.cjbmqg06qt2.eu-north-1.rds.amazonaws.com',
        port: 5432,
        user: 'postgres',
        password: password,
        database: 'postgres',
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🔄 Connecting to PostgreSQL...');
        await client.connect();
        console.log('✅ Connected successfully!');

        // Test query
        const result = await client.query('SELECT NOW() as current_time, version() as db_version');
        console.log('📅 Current time:', result.rows[0].current_time);
        console.log('📊 Database version:', result.rows[0].db_version.split(' ')[0], result.rows[0].db_version.split(' ')[1]);

        // List databases
        const databases = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname');
        console.log('\n🗃️  Available databases:');
        databases.rows.forEach((db, index) => {
            console.log(`   ${index + 1}. ${db.datname}`);
        });

        console.log('\n✅ PostgreSQL connection working perfectly!');
        console.log('📝 You can use this database for your admin panel.');

    } catch (error) {
        console.log('❌ Connection failed:', error.message);

        if (error.code === '28P01') {
            console.log('💡 Authentication failed - check your PostgreSQL password');
        } else if (error.code === 'ENOTFOUND') {
            console.log('💡 Host not found - check the hostname');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('💡 Connection refused - check security groups and network access');
        }

    } finally {
        await client.end();
    }
}

// Run the test
quickPostgresTest();
