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
 * Uses the query builder from models/queries.js and pg Pool's async API.
 */
const { getPool } = require('../db');
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
 * @param {string} start - Start date inclusive (YYYY-MM-DD)
 * @param {string} end - End date inclusive (YYYY-MM-DD)
 * @param {string[]} [categories] - Optional category filter; empty/undefined = all
 * @returns {Promise<{ products: Array, slowMovingThreshold: number|null, message: string|null }>}
 */
async function getPerformance(start, end, categories) {
  const pool = getPool();
  const filters = { start, end, categories };

  // Step 1: Get current period product performance
  const currentQuery = productPerformance(filters);
  const currentResult = await pool.query(currentQuery.sql, currentQuery.params);
  const currentProducts = currentResult.rows;

  // Step 2: Get previous period product performance for trend comparison
  const { prevStart, prevEnd } = calculatePreviousPeriod(start, end);
  const prevFilters = { start: prevStart, end: prevEnd, categories };
  const prevQuery = productPerformance(prevFilters);
  const prevResult = await pool.query(prevQuery.sql, prevQuery.params);
  const prevProducts = prevResult.rows;

  // Build a lookup map of previous period revenue by product name
  const prevRevenueMap = {};
  for (const row of prevProducts) {
    prevRevenueMap[row.product] = parseFloat(row.totalRevenue) || 0;
  }

  // Step 3: Compute trend for each product
  const productsWithTrend = currentProducts.map(product => {
    const totalRevenue = parseFloat(product.totalRevenue) || 0;
    const unitsSold = parseInt(product.unitsSold, 10) || 0;
    const prevRevenue = prevRevenueMap[product.product];
    let trend = 'stable';

    if (prevRevenue !== undefined && prevRevenue > 0) {
      const change = computePercentageChange(totalRevenue, prevRevenue);
      if (change !== null) {
        if (change > 5) trend = 'up';
        else if (change < -5) trend = 'down';
      }
    }

    return { product: product.product, category: product.category, totalRevenue, unitsSold, trend };
  });

  // Step 4: Slow-moving detection
  const productsWithSales = productsWithTrend.filter(p => p.unitsSold > 0);

  let slowMovingThreshold = null;

  if (productsWithSales.length > 0) {
    const totalUnits = productsWithSales.reduce((sum, p) => sum + p.unitsSold, 0);
    const average = totalUnits / productsWithSales.length;
    slowMovingThreshold = Math.round(average * 0.3);
  }

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
  const allProductsQuery = buildAllProductsQuery(categories);
  const allProductsResult = await pool.query(allProductsQuery.sql, allProductsQuery.params);
  const allProductRows = allProductsResult.rows;

  const existingProductNames = new Set(products.map(p => p.product));
  const zeroSaleProducts = allProductRows
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
 * @returns {Promise<{ products: Array }>}
 */
async function getTop(start, end, categories, limit = 5) {
  const pool = getPool();
  const filters = { start, end, categories };

  const { sql, params } = topProducts(filters, limit);
  const result = await pool.query(sql, params);

  const products = result.rows.map(row => ({
    product: row.product,
    category: row.category,
    totalRevenue: parseFloat(row.totalRevenue) || 0,
    unitsSold: parseInt(row.unitsSold, 10) || 0
  }));

  return { products };
}

/**
 * Returns category revenue breakdown with percentages for the selected date range.
 *
 * @param {string} start - Start date inclusive (YYYY-MM-DD)
 * @param {string} end - End date inclusive (YYYY-MM-DD)
 * @param {string[]} [categories] - Optional category filter; empty/undefined = all
 * @returns {Promise<{ categories: Array }>}
 */
async function getCategories(start, end, categories) {
  const pool = getPool();
  const filters = { start, end, categories };

  const { sql, params } = revenueByCategory(filters);
  const result = await pool.query(sql, params);

  const categoryResults = result.rows.map(row => ({
    category: row.category,
    revenue: parseFloat(row.categoryRevenue) || 0,
    percentage: parseFloat(row.percentage) || 0
  }));

  return { categories: categoryResults };
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
    const placeholders = categories.map((_, i) => `$${i + 1}`).join(', ');
    sql += ` WHERE category IN (${placeholders})`;
    params.push(...categories);
  }

  sql += ' ORDER BY product ASC';
  return { sql, params };
}

module.exports = { getPerformance, getTop, getCategories };
