/**
 * Database initialization and access layer.
 * Uses pg (node-postgres) Pool for async PostgreSQL access via Neon.
 */
require('dotenv').config();
const { Pool } = require('pg');

let pool;

/**
 * Returns the shared Pool instance, creating it on first call.
 * @returns {Pool}
 */
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

/**
 * Creates the transactions table and indexes if they do not exist.
 * Must be called once at application startup.
 */
async function initDb() {
  const p = getPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      product TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL,
      customer_id TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id)
  `);
}

module.exports = { getPool, initDb };
