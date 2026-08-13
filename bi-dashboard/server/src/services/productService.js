/**
 * Product Service
 *
 * Provides business logic for product performance analysis, top products,
 * and category revenue breakdown. Includes slow-moving product detection
 * and period-over-period trend classification.
 *
 * Three main functions:
 *   - getPerformance: full product table with trend indicator and slow-mover flag
 *   - getTop: top N products by revenue
 *   - getCategories: category revenue breakdown with percentages
 *
 * Uses the query builder from models/queries.js and better-sqlite3's synchronous API.
 */
const { getDb } = require('../db');
const {
  productPerformance,
  topProducts,
  revenueByCategory,
  calculatePreviousPeriod,
  computePercentageChange
} = require('../models/queries');

/**
 * Returns all products with performance metrics, trend indicators, and
 * slow-moving flags for the selected date range.
 *
 * Algorithm:
 *   1. Query current period product performance (revenue + units sold)
 *   2. Query previous period product performance for trend comparison
 *   3. Compute trend for each product: "up" if change >5%, "down" if <-5%, "stable" otherwise
 *   4. Detect slow-moving products:
 *      a. Filter products with unitsSold > 0
 *      b. Compute average = total units / count of products with sales
 *      c. Threshold = Math.round(average * 0.3)
 *      d. Flag products where unitsSold < threshold
 *   5. Include products with zero sales (exist in DB but no sales in range)
 *
 * @param {string} start - Start date inclusive (YYYY-MM-DD)
 * @param {string} end - End date inclusive (YYYY-MM-DD)
 * @param {string[]} [categories] - Optional category filter; empty/undefined = all
 * @returns {{ products: Array, slowMovingThreshold: number|null, message: string|null }}
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 7.1, 7.3, 7.4, 7.5, 7.6, 8.1, 8.3, 8.4
 */
function getPerformance(start, end, categories) {
  const db = getDb();
  const filters = { start, end, categories };

  // Step 1: Get current period product performance
  const currentQuery = productPerformance(filters);
  const currentProducts = db.prepare(currentQuery.sql).all(...currentQuery.params);

  // Step 2: Get previous period product performance for trend comparison
  const { prevStart, prevEnd } = calculatePreviousPeriod(start, end);
  const prevFilters = { start: prevStart, end: prevEnd, categories };
  const prevQuery = productPerformance(prevFilters);
  const prevProducts = db.prepare(prevQuery.sql).all(...prevQuery.params);

  // Build a lookup map of previous period revenue by product name
  const prevRevenueMap = {};
  for (const row of prevProducts) {
    prevRevenueMap[row.product] = row.totalRevenue;
  }

  // Step 3: Compute trend for each product
  // "up" if change > 5%, "down" if change < -5%, "stable" otherwise
  // If product has no previous data, trend = "stable"
  const productsWithTrend = currentProducts.map(product => {
    const prevRevenue = prevRevenueMap[product.product];
    let trend = 'stable';

    if (prevRevenue !== undefined && prevRevenue > 0) {
      const change = computePercentageChange(product.totalRevenue, prevRevenue);
      if (change !== null) {
        if (change > 5) trend = 'up';
        else if (change < -5) trend = 'down';
      }
    }
    // If no previous data (undefined) or previous revenue is 0, trend stays "stable"

    return { ...product, trend };
  });

  // Step 4: Slow-moving detection
  // a. Get all products with unitsSold > 0
  const productsWithSales = productsWithTrend.filter(p => p.unitsSold > 0);

  let slowMovingThreshold = null;

  if (productsWithSales.length > 0) {
    // b. Compute average units sold across products with at least 1 sale
    const totalUnits = productsWithSales.reduce((sum, p) => sum + p.unitsSold, 0);
    const average = totalUnits / productsWithSales.length;

    // c. Threshold = Math.round(average * 0.3)
    slowMovingThreshold = Math.round(average * 0.3);
  }

  // d. Flag products where unitsSold < threshold (and assign threshold info)
  const products = productsWithTrend.map(product => {
    const isSlowMoving = slowMovingThreshold !== null && product.unitsSold < slowMovingThreshold;
    return {
      product: product.product,
      category: product.category,
      totalRevenue: product.totalRevenue,
      unitsSold: product.unitsSold,
      trend: product.trend,
      isSlowMoving,
      slowMovingThreshold: isSlowMoving ? slowMovingThreshold : null
    };
  });

  // Step 5: Include products with zero sales in the period
  // These are products that exist in the DB but had no transactions in the date range.
  // We need to find all distinct products (optionally filtered by category) that aren't
  // already in our current results.
  const allProductsQuery = buildAllProductsQuery(categories);
  const allProducts = db.prepare(allProductsQuery.sql).all(...allProductsQuery.params);

  const existingProductNames = new Set(products.map(p => p.product));
  const zeroSaleProducts = allProducts
    .filter(p => !existingProductNames.has(p.product))
    .map(p => ({
      product: p.product,
      category: p.category,
      totalRevenue: 0,
      unitsSold: 0,
      trend: 'stable',
      isSlowMoving: slowMovingThreshold !== null && 0 < slowMovingThreshold,
      slowMovingThreshold: (slowMovingThreshold !== null && 0 < slowMovingThreshold) ? slowMovingThreshold : null
    }));

  const allProductResults = [...products, ...zeroSaleProducts];

  // Determine message for slow-moving products
  const hasSlowMoving = allProductResults.some(p => p.isSlowMoving);
  const message = hasSlowMoving ? null : 'No slow-moving products identified for the current filters';

  return {
    products: allProductResults,
    slowMovingThreshold,
    message: hasSlowMoving ? null : message
  };
}

/**
 * Returns top N products by revenue for the selected date range.
 *
 * @param {string} start - Start date inclusive (YYYY-MM-DD)
 * @param {string} end - End date inclusive (YYYY-MM-DD)
 * @param {string[]} [categories] - Optional category filter; empty/undefined = all
 * @param {number} [limit=5] - Number of top products to return
 * @returns {{ products: Array<{ product: string, category: string, totalRevenue: number, unitsSold: number }> }}
 *
 * Validates: Requirements 6.1, 6.4
 */
function getTop(start, end, categories, limit = 5) {
  const db = getDb();
  const filters = { start, end, categories };

  const { sql, params } = topProducts(filters, limit);
  const rows = db.prepare(sql).all(...params);

  const products = rows.map(row => ({
    product: row.product,
    category: row.category,
    totalRevenue: row.totalRevenue,
    unitsSold: row.unitsSold
  }));

  return { products };
}

/**
 * Returns category revenue breakdown with percentages for the selected date range.
 * Each category includes its total revenue and percentage of total revenue.
 * Percentages sum to 100% (±1% due to rounding).
 *
 * @param {string} start - Start date inclusive (YYYY-MM-DD)
 * @param {string} end - End date inclusive (YYYY-MM-DD)
 * @param {string[]} [categories] - Optional category filter; empty/undefined = all
 * @returns {{ categories: Array<{ category: string, revenue: number, percentage: number }> }}
 *
 * Validates: Requirements 6.2
 */
function getCategories(start, end, categories) {
  const db = getDb();
  const filters = { start, end, categories };

  const { sql, params } = revenueByCategory(filters);
  const rows = db.prepare(sql).all(...params);

  const result = rows.map(row => ({
    category: row.category,
    revenue: row.categoryRevenue,
    percentage: row.percentage
  }));

  return { categories: result };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a query to get all distinct product/category pairs from the database.
 * Used to identify products with zero sales in the selected period.
 *
 * @param {string[]} [categories] - Optional category filter
 * @returns {{ sql: string, params: any[] }}
 */
function buildAllProductsQuery(categories) {
  let sql = 'SELECT DISTINCT product, category FROM transactions';
  const params = [];

  if (categories && categories.length > 0) {
    const placeholders = categories.map(() => '?').join(', ');
    sql += ` WHERE category IN (${placeholders})`;
    params.push(...categories);
  }

  sql += ' ORDER BY product ASC';
  return { sql, params };
}

module.exports = { getPerformance, getTop, getCategories };
