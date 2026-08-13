/**
 * Customer Service
 *
 * Provides business logic for customer insights: repeat rate, top customers,
 * and customer segmentation. Uses the query builder from models/queries.js
 * and better-sqlite3's synchronous API.
 *
 * Main function:
 *   - getInsights: returns repeat rate, top 10 customers, and segment breakdown
 */
const { getDb } = require('../db');
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
 * Segmentation logic (relative to range end date):
 *   - Active: daysSinceLastPurchase ≤ 30
 *   - At-Risk: daysSinceLastPurchase > 60
 *   - Unclassified: between 30 and 60 (excluded from display)
 *
 * Repeat rate logic:
 *   - Repeat customer = purchaseCount > 1 within the date range
 *   - Rate = (repeat_count / total_unique_customers) * 100, rounded to whole number
 *
 * If fewer than 10 customers exist, returns all available (no padding).
 *
 * @param {string} start - Start date inclusive (YYYY-MM-DD)
 * @param {string} end - End date inclusive (YYYY-MM-DD)
 * @param {string[]} [categories] - Optional category filter; empty/undefined = all
 * @returns {{ repeatRate: object, topCustomers: array, segments: object }}
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
function getInsights(start, end, categories) {
  const db = getDb();
  const filters = { start, end, categories };

  // --- Repeat Rate ---
  // Get purchase frequency per customer within the date range
  const frequencyQuery = customerPurchaseFrequency(filters);
  const frequencyRows = db.prepare(frequencyQuery.sql).all(...frequencyQuery.params);

  const totalCustomers = frequencyRows.length;

  let repeatRate;
  if (totalCustomers === 0) {
    repeatRate = { repeat: 0, oneTime: 0 };
  } else {
    // A repeat customer has more than 1 purchase in the period
    const repeatCount = frequencyRows.filter(row => row.purchaseCount > 1).length;
    const oneTimeCount = totalCustomers - repeatCount;

    repeatRate = {
      repeat: Math.round((repeatCount / totalCustomers) * 100),
      oneTime: Math.round((oneTimeCount / totalCustomers) * 100)
    };
  }

  // --- Top Customers ---
  // Get top 10 customers by total spend (returns fewer if <10 exist)
  const topQuery = topCustomers(filters, 10);
  const topRows = db.prepare(topQuery.sql).all(...topQuery.params);

  const topCustomersList = topRows.map(row => ({
    customerId: row.customer_id,
    totalSpend: row.totalSpend,
    purchases: row.purchases
  }));

  // --- Customer Segmentation ---
  // Get days since last purchase relative to range end for each customer
  const recencyQuery = customerRecency(filters);
  const recencyRows = db.prepare(recencyQuery.sql).all(...recencyQuery.params);

  const totalUniqueCustomers = recencyRows.length;

  // Classify customers into segments
  let activeCount = 0;
  let atRiskCount = 0;

  for (const row of recencyRows) {
    if (row.daysSinceLastPurchase <= 30) {
      activeCount++;
    } else if (row.daysSinceLastPurchase > 60) {
      atRiskCount++;
    }
    // Customers between 30 and 60 days are unclassified (excluded from display)
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
