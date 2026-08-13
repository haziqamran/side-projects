/**
 * Recommendation Service
 *
 * Generates plain-English business insights from transaction data.
 * Uses three analysis passes:
 *   1. Declining categories (revenue drop ≥ 10% vs previous period)
 *   2. Zero-sale products (products with 0 units sold in selected range)
 *   3. Highest-growth category (max positive revenue change)
 *
 * Returns at least 3 recommendations when data permits,
 * with insufficientData flag when fewer than 3 can be generated.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
const { getDb } = require('../db');
const {
  revenueByCategory,
  calculatePreviousPeriod,
  productPerformance,
  computePercentageChange
} = require('../models/queries');

/**
 * Generates actionable business recommendations based on sales data.
 *
 * Algorithm (three passes):
 *   1. Declining categories: For each category, compare revenue to previous period.
 *      If change ≤ -10%, generate a decline recommendation.
 *   2. Zero-sale products: Find products with 0 units sold in selected range.
 *      Generate a recommendation listing up to 3 product names.
 *   3. Highest-growth category: Find category with maximum positive revenue change.
 *      Generate a growth recommendation.
 *
 * @param {string} start - Start date inclusive (YYYY-MM-DD)
 * @param {string} end - End date inclusive (YYYY-MM-DD)
 * @param {string[]} [categories] - Optional category filter; empty/undefined = all
 * @returns {{ recommendations: string[], insufficientData: boolean }}
 */
function getRecommendations(start, end, categories) {
  const db = getDb();
  const filters = { start, end, categories };

  // Calculate previous period dates for comparison
  const { prevStart, prevEnd } = calculatePreviousPeriod(start, end);
  const previousFilters = { start: prevStart, end: prevEnd, categories };

  // Get current period revenue by category
  const currentCategoryQuery = revenueByCategory(filters);
  const currentCategories = db.prepare(currentCategoryQuery.sql).all(...currentCategoryQuery.params);

  // Get previous period revenue by category
  const previousCategoryQuery = revenueByCategory(previousFilters);
  const previousCategories = db.prepare(previousCategoryQuery.sql).all(...previousCategoryQuery.params);

  // Get product performance for zero-sale detection
  const productQuery = productPerformance(filters);
  const products = db.prepare(productQuery.sql).all(...productQuery.params);

  // Build lookup map for previous category revenues
  const previousRevenueMap = {};
  for (const row of previousCategories) {
    previousRevenueMap[row.category] = row.categoryRevenue;
  }

  const recommendations = [];

  // ─── Pass 1: Declining categories ──────────────────────────────────────────
  for (const row of currentCategories) {
    const currentRevenue = row.categoryRevenue;
    const previousRevenue = previousRevenueMap[row.category] || 0;
    const change = computePercentageChange(currentRevenue, previousRevenue);

    if (change !== null && change <= -10) {
      const declinePercent = Math.abs(Math.round(change * 10) / 10);
      recommendations.push(
        `${row.category} revenue declined ${declinePercent}% compared to the previous period. Consider running a promotion to recover sales.`
      );
    }
  }

  // ─── Pass 2: Zero-sale products ────────────────────────────────────────────
  const zeroSaleProducts = products.filter(p => p.unitsSold === 0);
  if (zeroSaleProducts.length > 0) {
    // List up to 3 product names
    const productNames = zeroSaleProducts.slice(0, 3).map(p => p.product);
    const nameList = productNames.join(', ');
    recommendations.push(
      `${nameList} had zero sales this period. Consider promoting these items or reviewing their placement.`
    );
  }

  // ─── Pass 3: Highest-growth category ───────────────────────────────────────
  let highestGrowthCategory = null;
  let highestGrowthChange = 0;

  for (const row of currentCategories) {
    const currentRevenue = row.categoryRevenue;
    const previousRevenue = previousRevenueMap[row.category] || 0;
    const change = computePercentageChange(currentRevenue, previousRevenue);

    if (change !== null && change > 0 && change > highestGrowthChange) {
      highestGrowthChange = change;
      highestGrowthCategory = row.category;
    }
  }

  if (highestGrowthCategory !== null) {
    const growthPercent = Math.round(highestGrowthChange * 10) / 10;
    recommendations.push(
      `${highestGrowthCategory} is your fastest-growing category with ${growthPercent}% revenue increase. Consider expanding this product line.`
    );
  }

  // Set insufficientData flag if fewer than 3 insights generated
  const insufficientData = recommendations.length < 3;

  return { recommendations, insufficientData };
}

module.exports = { getRecommendations };
