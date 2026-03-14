const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.INSFORGE_POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

async function test() {
    try {
        console.log('Testing Postgres connection...');
        const res = await pool.query('SELECT NOW()');
        console.log('Success! Postgres time:', res.rows[0].now);
        await pool.end();
    } catch (error) {
        console.error('Postgres connection failed:', error.message);
    }
}

test();
