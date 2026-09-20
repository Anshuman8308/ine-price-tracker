const { Pool } = require('pg');
const config = require('./index');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

// Helper to run queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.nodeEnv === 'development') {
      console.log(`[DB] Query executed in ${duration}ms — rows: ${result.rowCount}`);
    }
    return result;
  } catch (error) {
    console.error('[DB] Query error:', error.message);
    throw error;
  }
};

// Helper to get a client for transactions
const getClient = async () => {
  const client = await pool.connect();
  return client;
};

// Test connection
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW()');
    console.log('[DB] Connected to PostgreSQL:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('[DB] Failed to connect:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
};
