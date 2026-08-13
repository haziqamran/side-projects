/**
 * Sales Service
 *
 * Provides business logic for sales overview metrics and revenue trend data.
 * Uses the query builder from models/queries.js and better-sqlite3's synchronous API.
 *
 * Two main functions:
 *   - getOverview: computes current/previous period metrics with percentage changes
 *   - getTrend: returns time-series revenue data grouped by granularity
 */
const { getDb } = require('../db');
const {
  revenueAggregation,
  revenueTrend,
  periodOverPeriod,
  computePercentageChange
} = require('../models/queries');

/**
 * Computes sales overview metrics for the current period and the equivalent
 * previous period, including percentage changes.
 *
 * Revenue = SUM(quantity * unit_price)
 * Orders  = COUNT(*)
 * Avg Order Value = totalRevenue / totalOrders (0 if no orders)
 *
 * When the previous period has no orders (totalOrders = 0), all change values
 * are set to null (displayed as "N/A" on the frontend).
 *
 * @param {string} start - Start date inclusive (YYYY-MM-DD)
 * @param {string} end - End date inclusive (YYYY-MM-DD)
 * @param {string[]} [categories] - Optional category filter; empty/undefined = all
 * @returns {{ current: object, previous: object, change: object }}
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
function getOverview(start, end, categories) {
  const db = getDb();
  const filters = { start, end, categories };

  // Get query objects for both current and previous periods
  const { current: currentQuery, previous: previousQuery } = periodOverPeriod(filters);

  // Execute both queries (synchronous better-sqlite3 API)
  const currentRow = db.prepare(currentQuery.sql).get(...currentQuery.params);
  const previousRow = db.prepare(previousQuery.sql).get(...previousQuery.params);

  // Compute average order value, handling division by zero
  const currentAvg = currentRow.totalOrders > 0
    ? currentRow.totalRevenue / currentRow.totalOrders
    : 0;
  const previousAvg = previousRow.totalOrders > 0
    ? previousRow.totalRevenue / previousRow.totalOrders
    : 0;

  const current = {
    totalRevenue: currentRow.totalRevenue,
    totalOrders: currentRow.totalOrders,
    avgOrderValue: Math.round(currentAvg * 100) / 100
  };

  const previous = {
    totalRevenue: previousRow.totalRevenue,
    totalOrders: previousRow.totalOrders,
    avgOrderValue: Math.round(previousAvg * 100) / 100
  };

  // When previous period has no data (totalOrders = 0), set all changes to null
  let change;
  if (previousRow.totalOrders === 0) {
    change = {
      totalRevenue: null,
      totalOrders: null,
      avgOrderValue: null
    };
  } else {
    change = {
      totalRevenue: computePercentageChange(current.totalRevenue, previous.totalRevenue),
      totalOrders: computePercentageChange(current.totalOrders, previous.totalOrders),
      avgOrderValue: computePercentageChange(current.avgOrderValue, previous.avgOrderValue)
    };
  }

  return { current, previous, change };
}

/**
 * Returns time-series revenue data grouped by the specified granularity.
 * Used for the revenue trend line chart on the Sales Overview page.
 *
 * Each data point contains:
 *   - period: the time bucket label (date, week identifier, or month)
 *   - revenue: total revenue for that bucket
 *
 * @param {string} start - Start date inclusive (YYYY-MM-DD)
 * @param {string} end - End date inclusive (YYYY-MM-DD)
 * @param {string[]} [categories] - Optional category filter; empty/undefined = all
 * @param {'daily'|'weekly'|'monthly'} [granularity='daily'] - Grouping level
 * @returns {{ data: Array<{ period: string, revenue: number }> }}
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */
function getTrend(start, end, categories, granularity = 'daily') {
  const db = getDb();
  const filters = { start, end, categories };

  // Build and execute the trend query
  const { sql, params } = revenueTrend(filters, granularity);
  const rows = db.prepare(sql).all(...params);

  // Map rows to the expected response shape
  const data = rows.map(row => ({
    period: row.period,
    revenue: row.revenue
  }));

  return { data };
}

module.exports = { getOverview, getTrend };
