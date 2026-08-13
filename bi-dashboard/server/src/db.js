/**
 * Database initialization and access layer.
 * Uses better-sqlite3 for synchronous, fast SQLite access.
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'dashboard.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // Better concurrent read performance
    initSchema();
  }
  return db;
}

/**
 * Creates the transactions table if it does not exist.
 * Schema matches the CSV columns: date, product, category, quantity, unit_price, customer_id, payment_method.
 */
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      product TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      customer_id TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
  `);
}

module.exports = { getDb };
