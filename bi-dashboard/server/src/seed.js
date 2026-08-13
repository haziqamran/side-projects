/**
 * Seed Data Generator
 * Produces ~5,000 realistic transaction records spanning 6 months.
 * Run with: npm run seed
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'dashboard.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create schema
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

// Seed data configuration
const categories = {
  'Beverages': ['Latte', 'Cappuccino', 'Green Tea', 'Iced Mocha', 'Fresh Juice'],
  'Food': ['Croissant', 'Club Sandwich', 'Caesar Salad', 'Pasta Carbonara', 'Chicken Wrap'],
  'Desserts': ['Chocolate Cake', 'Tiramisu', 'Cheesecake', 'Brownie', 'Ice Cream Sundae'],
  'Snacks': ['Fries', 'Nachos', 'Spring Rolls', 'Garlic Bread', 'Onion Rings'],
  'Merchandise': ['Tumbler', 'Tote Bag', 'Coffee Beans 250g', 'Gift Card', 'Mug']
};

const paymentMethods = ['Cash', 'Credit Card', 'Debit Card', 'E-Wallet'];

/**
 * Generates a random date (YYYY-MM-DD) between start and end dates (inclusive).
 * Used to distribute seed transactions evenly across the 6-month range.
 *
 * @param {Date} start - Range start (inclusive)
 * @param {Date} end - Range end (inclusive)
 * @returns {string} Random date in YYYY-MM-DD format
 */
function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split('T')[0];
}

const startDate = new Date('2026-01-01');
const endDate = new Date('2026-06-30');

// Generate customer IDs (50+)
const customerIds = Array.from({ length: 60 }, (_, i) => `CUST-${String(i + 1).padStart(3, '0')}`);

// Build records
const records = [];
const TARGET = 5500;

for (let i = 0; i < TARGET; i++) {
  const catNames = Object.keys(categories);
  const category = catNames[Math.floor(Math.random() * catNames.length)];
  const products = categories[category];
  const product = products[Math.floor(Math.random() * products.length)];

  // Price ranges by category for realism
  const priceRanges = {
    'Beverages': [3.5, 8.0],
    'Food': [8.0, 18.0],
    'Desserts': [5.0, 12.0],
    'Snacks': [4.0, 10.0],
    'Merchandise': [12.0, 35.0]
  };
  const [minPrice, maxPrice] = priceRanges[category];
  const unitPrice = +(minPrice + Math.random() * (maxPrice - minPrice)).toFixed(2);

  records.push({
    date: randomDate(startDate, endDate),
    product,
    category,
    quantity: Math.floor(Math.random() * 4) + 1,
    unit_price: unitPrice,
    customer_id: customerIds[Math.floor(Math.random() * customerIds.length)],
    payment_method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)]
  });
}

// Batch insert for performance
const insert = db.prepare(`
  INSERT INTO transactions (date, product, category, quantity, unit_price, customer_id, payment_method)
  VALUES (@date, @product, @category, @quantity, @unit_price, @customer_id, @payment_method)
`);

const insertMany = db.transaction((rows) => {
  for (const row of rows) {
    insert.run(row);
  }
});

insertMany(records);

console.log(`✓ Seeded ${records.length} transaction records`);
console.log(`  Categories: ${Object.keys(categories).length}`);
console.log(`  Products: ${Object.values(categories).flat().length}`);
console.log(`  Customers: ${customerIds.length}`);
console.log(`  Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

db.close();
