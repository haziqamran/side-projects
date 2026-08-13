/**
 * Seed Data Generator (standalone script)
 * Produces ~5,500 realistic transaction records spanning 6 months.
 * Run with: npm run seed
 */
require('dotenv').config();
const { getPool, initDb } = require('./db');

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
 *
 * @param {Date} start - Range start (inclusive)
 * @param {Date} end - Range end (inclusive)
 * @returns {string} Random date in YYYY-MM-DD format
 */
function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split('T')[0];
}

async function main() {
  // Ensure table exists
  await initDb();

  const pool = getPool();
  const startDate = new Date('2026-01-01');
  const endDate = new Date('2026-06-30');

  // Generate customer IDs (60 customers)
  const customerIds = Array.from({ length: 60 }, (_, i) => `CUST-${String(i + 1).padStart(3, '0')}`);

  // Build records
  const records = [];
  const TARGET = 5500;

  for (let i = 0; i < TARGET; i++) {
    const catNames = Object.keys(categories);
    const category = catNames[Math.floor(Math.random() * catNames.length)];
    const products = categories[category];
    const product = products[Math.floor(Math.random() * products.length)];

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

  // Batch insert using a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const row of records) {
      await client.query(
        `INSERT INTO transactions (date, product, category, quantity, unit_price, customer_id, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [row.date, row.product, row.category, row.quantity, row.unit_price, row.customer_id, row.payment_method]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  console.log(`✓ Seeded ${records.length} transaction records`);
  console.log(`  Categories: ${Object.keys(categories).length}`);
  console.log(`  Products: ${Object.values(categories).flat().length}`);
  console.log(`  Customers: ${customerIds.length}`);
  console.log(`  Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

  await pool.end();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
