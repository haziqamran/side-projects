/**
 * Sales Service
 *
 * Provides business logic for sales overview metrics and revenue trend data.
 * Uses the query builder from models/queries.js and pg Pool's async API.
 *
 * Two main functions:
 *   - getOverview: computes current/previous period metrics with percentage changes
 *   - getTrend: returns time-series revenue data grouped by granularity
 */
const { getPool } = require('../db');
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
 * @returns {Promise<{ current: object, previous: object, change: object }>}
 */
async function getOverview(start, end, categories) {
  const pool = getPool();
  const filters = { start, end, categories };

  // Get query objects for both current and previous periods
  const { current: currentQuery, previous: previousQuery } = periodOverPeriod(filters);

  // Execute both queries (async pg API)
  const currentResult = await pool.query(currentQuery.sql, currentQuery.params);
  const previousResult = await pool.query(previousQuery.sql, previousQuery.params);

  const currentRow = currentResult.rows[0];
  const previousRow = previousResult.rows[0];

  // pg returns numeric columns as strings — parse them
  const currentRevenue = parseFloat(currentRow.totalRevenue) || 0;
  const currentOrders = parseInt(currentRow.totalOrders, 10) || 0;
  const previousRevenue = parseFloat(previousRow.totalRevenue) || 0;
  const previousOrders = parseInt(previousRow.totalOrders, 10) || 0;

  // Compute average order value, handling division by zero
  const currentAvg = currentOrders > 0 ? currentRevenue / currentOrders : 0;
  const previousAvg = previousOrders > 0 ? previousRevenue / previousOrders : 0;

  const current = {
    totalRevenue: currentRevenue,
    totalOrders: currentOrders,
    avgOrderValue: Math.round(currentAvg * 100) / 100
  };

  const previous = {
    totalRevenue: previousRevenue,
    totalOrders: previousOrders,
    avgOrderValue: Math.round(previousAvg * 100) / 100
  };

  // When previous period has no data (totalOrders = 0), set all changes to null
  let change;
  if (previousOrders === 0) {
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
 * @returns {Promise<{ data: Array<{ period: string, revenue: number }> }>}
 */
async function getTrend(start, end, categories, granularity = 'daily') {
  const pool = getPool();
  const filters = { start, end, categories };

  // Build and execute the trend query
  const { sql, params } = revenueTrend(filters, granularity);
  const result = await pool.query(sql, params);

  // Map rows to the expected response shape
  const data = result.rows.map(row => ({
    period: row.period,
    revenue: parseFloat(row.revenue) || 0
  }));

  return { data };
}

module.exports = { getOverview, getTrend };
