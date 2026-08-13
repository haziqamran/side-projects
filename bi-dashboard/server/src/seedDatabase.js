/**
 * Seed Database Function
 * Wraps the seed data generation logic so it can be called from the API route.
 * Produces ~5,500 realistic transaction records spanning 6 months.
 */
const { getDb } = require('./db');

// Seed data configuration
const categories = {
  'Beverages': ['Latte', 'Cappuccino', 'Green Tea', 'Iced Mocha', 'Fresh Juice'],
  'Food': ['Croissant', 'Club Sandwich', 'Caesar Salad', 'Pasta Carbonara', 'Chicken Wrap'],
  'Desserts': ['Chocolate Cake', 'Tiramisu', 'Cheesecake', 'Brownie', 'Ice Cream Sundae'],
  'Snacks': ['Fries', 'Nachos', 'Spring Rolls', 'Garlic Bread', 'Onion Rings'],
  'Merchandise': ['Tumbler', 'Tote Bag', 'Coffee Beans 250g', 'Gift Card', 'Mug']
};

const paymentMethods = ['Cash', 'Credit Card', 'Debit Card', 'E-Wallet'];

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split('T')[0];
}

/**
 * Generates and inserts seed data into the database.
 * Uses the shared getDb() connection rather than creating a new one.
 *
 * @returns {{ count: number }} Number of records inserted
 */
function seedDatabase() {
  const db = getDb();

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

  return { count: records.length };
}

module.exports = { seedDatabase };
