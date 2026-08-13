/**
 * Sales Routes
 *
 * Provides endpoints for sales overview metrics and revenue trend data.
 * Both endpoints accept date range filters and an optional category filter.
 *
 * Routes:
 *   GET /api/sales/overview — aggregate metrics with period-over-period change
 *   GET /api/sales/trend   — time-series revenue grouped by granularity
 */
const express = require('express');
const router = express.Router();
const salesService = require('../services/salesService');

/**
 * Parses the categories query param into an array.
 * Empty string or omitted = all categories (returns undefined).
 *
 * @param {string|undefined} categoriesParam - Comma-separated category string
 * @returns {string[]|undefined} Array of category names, or undefined for all
 */
function parseCategories(categoriesParam) {
  if (!categoriesParam || categoriesParam.trim() === '') {
    return undefined;
  }
  return categoriesParam.split(',').map(c => c.trim()).filter(c => c.length > 0);
}

/**
 * Validates that start and end dates are present and that start <= end.
 * Returns an error message string if invalid, or null if valid.
 *
 * @param {string|undefined} start - Start date (YYYY-MM-DD)
 * @param {string|undefined} end - End date (YYYY-MM-DD)
 * @returns {string|null} Error message or null
 */
function validateDateRange(start, end) {
  if (!start || !end) {
    return 'Both start and end query parameters are required';
  }
  if (start > end) {
    return 'Start date must be before end date';
  }
  return null;
}

/**
 * GET /api/sales/overview
 *
 * Query params:
 *   - start (required): YYYY-MM-DD
 *   - end (required): YYYY-MM-DD
 *   - categories (optional): comma-separated category names
 *
 * Returns current/previous period metrics and percentage changes.
 */
router.get('/overview', async (req, res) => {
  try {
    const { start, end, categories: categoriesParam } = req.query;

    const error = validateDateRange(start, end);
    if (error) {
      return res.status(400).json({ error });
    }

    const categories = parseCategories(categoriesParam);
    const result = await salesService.getOverview(start, end, categories);

    res.json(result);
  } catch (err) {
    console.error('Error in GET /api/sales/overview:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/sales/trend
 *
 * Query params:
 *   - start (required): YYYY-MM-DD
 *   - end (required): YYYY-MM-DD
 *   - categories (optional): comma-separated category names
 *   - granularity (optional): 'daily' | 'weekly' | 'monthly' (defaults to 'daily')
 *
 * Returns time-series revenue data grouped by the specified granularity.
 */
router.get('/trend', async (req, res) => {
  try {
    const { start, end, categories: categoriesParam, granularity } = req.query;

    const error = validateDateRange(start, end);
    if (error) {
      return res.status(400).json({ error });
    }

    const categories = parseCategories(categoriesParam);
    const validGranularities = ['daily', 'weekly', 'monthly'];
    const resolvedGranularity = validGranularities.includes(granularity) ? granularity : 'daily';

    const result = await salesService.getTrend(start, end, categories, resolvedGranularity);

    res.json(result);
  } catch (err) {
    console.error('Error in GET /api/sales/trend:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
