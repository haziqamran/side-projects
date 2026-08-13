/**
 * Reusable SQL Query Builder Module (PostgreSQL / Neon)
 *
 * Provides parameterized query functions for the BI Dashboard.
 * All functions return objects: { sql, params }
 * designed for use with pg Pool's query(sql, params) API.
 *
 * PostgreSQL uses numbered placeholders ($1, $2, $3, ...) instead of ?.
 *
 * The transactions table schema:
 *   id, date, product, category, quantity, unit_price, customer_id, payment_method, created_at
 *
 * Revenue is always computed as SUM(quantity * unit_price).
 */

// ─────────────────────────────────────────────────────────────────────────────
// WHERE Clause Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a WHERE clause for date-range and optional category filtering.
 * Returns the clause string (including "WHERE"), an array of bound params,
 * and the next available parameter index.
 *
 * @param {object} filters
 * @param {string} filters.start - Start date inclusive (YYYY-MM-DD)
 * @param {string} filters.end   - End date inclusive (YYYY-MM-DD)
 * @param {string[]} [filters.categories] - Optional array of category names; empty/undefined means all
 * @param {number} [startIndex=1] - Starting parameter index for numbered placeholders
 * @returns {{ clause: string, params: any[], nextIndex: number }}
 */
function buildWhereClause(filters, startIndex = 1) {
  const conditions = [];
  const params = [];
  let idx = startIndex;

  // Date range is always required for dashboard queries
  conditions.push(`date >= $${idx} AND date <= $${idx + 1}`);
  params.push(filters.start, filters.end);
  idx += 2;

  // Category filter: only applied when a non-empty array is provided
  if (filters.categories && filters.categories.length > 0) {
    const placeholders = filters.categories.map(() => `$${idx++}`).join(', ');
    conditions.push(`category IN (${placeholders})`);
    params.push(...filters.categories);
  }

  const clause = 'WHERE ' + conditions.join(' AND ');
  return { clause, params, nextIndex: idx };
}

/**
 * Convenience: builds WHERE clause string and params for a previous period.
 * The previous period has the same duration as [start, end] and ends the day
 * before `start`.
 *
 * @param {object} filters - Same shape as buildWhereClause input
 * @param {number} [startIndex=1] - Starting parameter index
 * @returns {{ clause: string, params: any[], nextIndex: number }}
 */
function buildPreviousPeriodWhereClause(filters, startIndex = 1) {
  const { prevStart, prevEnd } = calculatePreviousPeriod(filters.start, filters.end);
  return buildWhereClause({ ...filters, start: prevStart, end: prevEnd }, startIndex);
}

// ─────────────────────────────────────────────────────────────────────────────
// Period Calculation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a date range [start, end], calculates the previous period of equal
 * length that ends the day before `start`.
 *
 * Algorithm:
 *   1. Compute N = number of days in range (inclusive): end - start + 1
 *   2. Previous period end = start - 1 day
 *   3. Previous period start = previous end - (N - 1) days
 *
 * @param {string} start - YYYY-MM-DD
 * @param {string} end   - YYYY-MM-DD
 * @returns {{ prevStart: string, prevEnd: string, days: number }}
 */
function calculatePreviousPeriod(start, end) {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');

  // Number of days in the current period (inclusive of both endpoints)
  const days = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  // Previous period ends the day before current start
  const prevEndDate = new Date(startDate);
  prevEndDate.setDate(prevEndDate.getDate() - 1);

  // Previous period starts (days - 1) days before its own end
  const prevStartDate = new Date(prevEndDate);
  prevStartDate.setDate(prevStartDate.getDate() - (days - 1));

  return {
    prevStart: formatDate(prevStartDate),
    prevEnd: formatDate(prevEndDate),
    days
  };
}

/**
 * Formats a Date object to YYYY-MM-DD string.
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue Aggregation Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a query that computes total revenue, total orders, and average order
 * value for the given filters.
 *
 * Revenue = SUM(quantity * unit_price)
 * Orders  = COUNT(*)
 * AOV     = Revenue / Orders (computed in JS to handle division-by-zero)
 *
 * @param {object} filters - { start, end, categories? }
 * @returns {{ sql: string, params: any[] }}
 */
function revenueAggregation(filters) {
  const { clause, params } = buildWhereClause(filters);

  const sql = `
    SELECT
      COALESCE(SUM(quantity * unit_price), 0) AS "totalRevenue",
      COUNT(*) AS "totalOrders"
    FROM transactions
    ${clause}
  `;

  return { sql, params };
}

/**
 * Returns a query for revenue aggregated by time period (daily, weekly, monthly).
 * Used for the revenue trend line chart.
 *
 * Granularity grouping (PostgreSQL):
 *   - daily:   GROUP BY date (cast to text)
 *   - weekly:  GROUP BY TO_CHAR(date, 'IYYY-"W"IW')  (ISO week)
 *   - monthly: GROUP BY TO_CHAR(date, 'YYYY-MM')
 *
 * @param {object} filters - { start, end, categories? }
 * @param {'daily'|'weekly'|'monthly'} granularity
 * @returns {{ sql: string, params: any[] }}
 */
function revenueTrend(filters, granularity = 'daily') {
  const { clause, params } = buildWhereClause(filters);

  // Determine the GROUP BY expression based on granularity
  let periodExpr;
  switch (granularity) {
    case 'weekly':
      periodExpr = "TO_CHAR(date, 'IYYY-\"W\"IW')";
      break;
    case 'monthly':
      periodExpr = "TO_CHAR(date, 'YYYY-MM')";
      break;
    case 'daily':
    default:
      periodExpr = "TO_CHAR(date, 'YYYY-MM-DD')";
      break;
  }

  const sql = `
    SELECT
      ${periodExpr} AS period,
      COALESCE(SUM(quantity * unit_price), 0) AS revenue
    FROM transactions
    ${clause}
    GROUP BY ${periodExpr}
    ORDER BY period ASC
  `;

  return { sql, params };
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a query for units sold per product within the filtered range.
 * Results include product name, category, total revenue, and units sold,
 * sorted by revenue descending.
 *
 * @param {object} filters - { start, end, categories? }
 * @returns {{ sql: string, params: any[] }}
 */
function productPerformance(filters) {
  const { clause, params } = buildWhereClause(filters);

  const sql = `
    SELECT
      product,
      category,
      COALESCE(SUM(quantity * unit_price), 0) AS "totalRevenue",
      COALESCE(SUM(quantity), 0) AS "unitsSold"
    FROM transactions
    ${clause}
    GROUP BY product, category
    ORDER BY "totalRevenue" DESC
  `;

  return { sql, params };
}

/**
 * Returns a query for the top N products by revenue.
 *
 * @param {object} filters - { start, end, categories? }
 * @param {number} [limit=5] - Number of top products to return
 * @returns {{ sql: string, params: any[] }}
 */
function topProducts(filters, limit = 5) {
  const { clause, params, nextIndex } = buildWhereClause(filters);

  const sql = `
    SELECT
      product,
      category,
      COALESCE(SUM(quantity * unit_price), 0) AS "totalRevenue",
      COALESCE(SUM(quantity), 0) AS "unitsSold"
    FROM transactions
    ${clause}
    GROUP BY product, category
    ORDER BY "totalRevenue" DESC
    LIMIT $${nextIndex}
  `;

  params.push(limit);
  return { sql, params };
}

/**
 * Returns a query for revenue breakdown by category, including each
 * category's percentage of total revenue.
 *
 * Uses a subquery to compute the total across all categories in one pass.
 * Percentage = (category_revenue / total_revenue) * 100
 *
 * @param {object} filters - { start, end, categories? }
 * @returns {{ sql: string, params: any[] }}
 */
function revenueByCategory(filters) {
  const { clause, params, nextIndex } = buildWhereClause(filters);

  // Build a second WHERE clause for the subquery with continued param numbering
  const { clause: subClause, params: subParams } = buildWhereClause(filters, nextIndex);

  const sql = `
    SELECT
      category,
      COALESCE(SUM(quantity * unit_price), 0) AS "categoryRevenue",
      ROUND(
        COALESCE(SUM(quantity * unit_price), 0) * 100.0 /
        NULLIF((SELECT SUM(quantity * unit_price) FROM transactions ${subClause}), 0),
        1
      ) AS percentage
    FROM transactions
    ${clause}
    GROUP BY category
    ORDER BY "categoryRevenue" DESC
  `;

  // The subquery uses continued param numbering so combine both param arrays
  return { sql, params: [...params, ...subParams] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a query for customer purchase frequency within the date range.
 * Used to determine repeat vs one-time customers.
 *
 * A repeat customer has more than one transaction (COUNT > 1) in the period.
 *
 * @param {object} filters - { start, end, categories? }
 * @returns {{ sql: string, params: any[] }}
 */
function customerPurchaseFrequency(filters) {
  const { clause, params } = buildWhereClause(filters);

  const sql = `
    SELECT
      customer_id,
      COUNT(*) AS "purchaseCount",
      COALESCE(SUM(quantity * unit_price), 0) AS "totalSpend",
      MAX(date) AS "lastPurchaseDate"
    FROM transactions
    ${clause}
    GROUP BY customer_id
  `;

  return { sql, params };
}

/**
 * Returns a query for top N customers ranked by total spend.
 *
 * @param {object} filters - { start, end, categories? }
 * @param {number} [limit=10] - Number of top customers to return
 * @returns {{ sql: string, params: any[] }}
 */
function topCustomers(filters, limit = 10) {
  const { clause, params, nextIndex } = buildWhereClause(filters);

  const sql = `
    SELECT
      customer_id,
      COALESCE(SUM(quantity * unit_price), 0) AS "totalSpend",
      COUNT(*) AS purchases
    FROM transactions
    ${clause}
    GROUP BY customer_id
    ORDER BY "totalSpend" DESC
    LIMIT $${nextIndex}
  `;

  params.push(limit);
  return { sql, params };
}

/**
 * Returns a query for customer recency — days since each customer's last purchase
 * relative to the end of the selected date range.
 *
 * Uses PostgreSQL date arithmetic: (end_date::date - MAX(date)::date) gives integer days.
 *
 * Used for customer segmentation:
 *   - Active: lastPurchase within 30 days of range end
 *   - At-Risk: lastPurchase more than 60 days before range end
 *
 * @param {object} filters - { start, end, categories? }
 * @returns {{ sql: string, params: any[] }}
 */
function customerRecency(filters) {
  // The end date param comes first ($1), then the WHERE clause params follow
  const { clause, params: whereParams, nextIndex } = buildWhereClause(filters, 2);

  const sql = `
    SELECT
      customer_id,
      MAX(date) AS "lastPurchaseDate",
      ($1::date - MAX(date)::date) AS "daysSinceLastPurchase"
    FROM transactions
    ${clause}
    GROUP BY customer_id
  `;

  // The range end date is $1, then WHERE clause params start at $2
  return { sql, params: [filters.end, ...whereParams] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Period-Over-Period Comparison
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns query objects for both current and previous period revenue aggregation.
 * Services can run both queries and compute percentage change in JS.
 *
 * Percentage change formula: ((current - previous) / previous) * 100
 * Returns null when previous value is 0 (no meaningful comparison).
 *
 * @param {object} filters - { start, end, categories? }
 * @returns {{ current: { sql, params }, previous: { sql, params }, prevDates: { prevStart, prevEnd } }}
 */
function periodOverPeriod(filters) {
  const { prevStart, prevEnd } = calculatePreviousPeriod(filters.start, filters.end);

  const current = revenueAggregation(filters);
  const previous = revenueAggregation({ ...filters, start: prevStart, end: prevEnd });

  return {
    current,
    previous,
    prevDates: { prevStart, prevEnd }
  };
}

/**
 * Computes percentage change between two numeric values.
 * Returns null if previous is 0 (cannot divide by zero — displayed as "N/A" on frontend).
 *
 * @param {number} current  - Current period value
 * @param {number} previous - Previous period value
 * @returns {number|null} - Percentage change rounded to 1 decimal, or null
 */
function computePercentageChange(current, previous) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a query to fetch all distinct categories in the database.
 * Used to populate the category filter dropdown.
 *
 * @returns {{ sql: string, params: any[] }}
 */
function allCategories() {
  return {
    sql: 'SELECT DISTINCT category FROM transactions ORDER BY category ASC',
    params: []
  };
}

/**
 * Returns a query to find the latest transaction date in the database.
 * Used to compute the default 30-day date range on initial dashboard load.
 *
 * @returns {{ sql: string, params: any[] }}
 */
function latestTransactionDate() {
  return {
    sql: 'SELECT MAX(date) AS "latestDate" FROM transactions',
    params: []
  };
}

/**
 * Returns a query to count total rows in the transactions table.
 * Used by the upload status endpoint to check if data exists.
 *
 * @returns {{ sql: string, params: any[] }}
 */
function transactionCount() {
  return {
    sql: 'SELECT COUNT(*) AS count FROM transactions',
    params: []
  };
}

module.exports = {
  // WHERE clause builders
  buildWhereClause,
  buildPreviousPeriodWhereClause,

  // Period helpers
  calculatePreviousPeriod,
  formatDate,
  computePercentageChange,

  // Revenue queries
  revenueAggregation,
  revenueTrend,

  // Product queries
  productPerformance,
  topProducts,
  revenueByCategory,

  // Customer queries
  customerPurchaseFrequency,
  topCustomers,
  customerRecency,

  // Period-over-period
  periodOverPeriod,

  // Utility queries
  allCategories,
  latestTransactionDate,
  transactionCount
};
