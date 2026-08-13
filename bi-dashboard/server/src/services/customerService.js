/**
 * Customer Service
 *
 * Provides business logic for customer insights: repeat rate, top customers,
 * and customer segmentation. Uses the query builder from models/queries.js
 * and pg Pool's async API.
 *
 * Main function:
 *   - getInsights: returns repeat rate, top 10 customers, and segment breakdown
 */
const { getPool } = require('../db');
const {
  customerPurchaseFrequency,
  topCustomers,
  customerRecency
} = require('../models/queries');

/**
 * Computes customer insights for the selected date range and optional categories.
 *
 * Returns:
 *   - repeatRate: percentage split between repeat (>1 purchase) and one-time customers
 *   - topCustomers: top 10 customers ranked by total spend
 *   - segments: active (≤30 days) and at-risk (>60 days) customer counts/percentages
 *
 * @param {string} start - Start date inclusive (YYYY-MM-DD)
 * @param {string} end - End date inclusive (YYYY-MM-DD)
 * @param {string[]} [categories] - Optional category filter; empty/undefined = all
 * @returns {Promise<{ repeatRate: object, topCustomers: array, segments: object }>}
 */
async function getInsights(start, end, categories) {
  const pool = getPool();
  const filters = { start, end, categories };

  // --- Repeat Rate ---
  const frequencyQuery = customerPurchaseFrequency(filters);
  const frequencyResult = await pool.query(frequencyQuery.sql, frequencyQuery.params);
  const frequencyRows = frequencyResult.rows;

  const totalCustomers = frequencyRows.length;

  let repeatRate;
  if (totalCustomers === 0) {
    repeatRate = { repeat: 0, oneTime: 0 };
  } else {
    const repeatCount = frequencyRows.filter(row => parseInt(row.purchaseCount, 10) > 1).length;
    const oneTimeCount = totalCustomers - repeatCount;

    repeatRate = {
      repeat: Math.round((repeatCount / totalCustomers) * 100),
      oneTime: Math.round((oneTimeCount / totalCustomers) * 100)
    };
  }

  // --- Top Customers ---
  const topQuery = topCustomers(filters, 10);
  const topResult = await pool.query(topQuery.sql, topQuery.params);
  const topRows = topResult.rows;

  const topCustomersList = topRows.map(row => ({
    customerId: row.customer_id,
    totalSpend: parseFloat(row.totalSpend) || 0,
    purchases: parseInt(row.purchases, 10) || 0
  }));

  // --- Customer Segmentation ---
  const recencyQuery = customerRecency(filters);
  const recencyResult = await pool.query(recencyQuery.sql, recencyQuery.params);
  const recencyRows = recencyResult.rows;

  const totalUniqueCustomers = recencyRows.length;

  let activeCount = 0;
  let atRiskCount = 0;

  for (const row of recencyRows) {
    const daysSince = parseInt(row.daysSinceLastPurchase, 10) || 0;
    if (daysSince <= 30) {
      activeCount++;
    } else if (daysSince > 60) {
      atRiskCount++;
    }
  }

  let segments;
  if (totalUniqueCustomers === 0) {
    segments = {
      active: { count: 0, percentage: 0 },
      atRisk: { count: 0, percentage: 0 }
    };
  } else {
    segments = {
      active: {
        count: activeCount,
        percentage: Math.round((activeCount / totalUniqueCustomers) * 100)
      },
      atRisk: {
        count: atRiskCount,
        percentage: Math.round((atRiskCount / totalUniqueCustomers) * 100)
      }
    };
  }

  return { repeatRate, topCustomers: topCustomersList, segments };
}

module.exports = { getInsights };
