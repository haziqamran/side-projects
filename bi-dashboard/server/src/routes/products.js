/**
 * Product Routes
 *
 * Provides endpoints for product performance metrics, top products,
 * and category revenue breakdown.
 *
 * Routes:
 *   GET /api/products/performance — full product table with trend + slow-mover flag
 *   GET /api/products/top         — top N products by revenue
 *   GET /api/products/categories  — category breakdown (donut chart data)
 */
const express = require('express');
const router = express.Router();
const productService = require('../services/productService');

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
 * GET /api/products/performance
 *
 * Query params:
 *   - start (required): YYYY-MM-DD
 *   - end (required): YYYY-MM-DD
 *   - categories (optional): comma-separated category names
 *   - sort (optional): column name to sort by
 *   - order (optional): 'asc' | 'desc' (defaults to 'desc')
 *
 * Returns product performance data with trend indicators and slow-mover flags.
 */
router.get('/performance', (req, res) => {
  try {
    const { start, end, categories: categoriesParam, sort, order } = req.query;

    const error = validateDateRange(start, end);
    if (error) {
      return res.status(400).json({ error });
    }

    const categories = parseCategories(categoriesParam);
    const result = productService.getPerformance(start, end, categories);

    // Apply sorting if sort param is provided
    if (sort && result.products) {
      const validColumns = ['product', 'category', 'totalRevenue', 'unitsSold', 'trend'];
      if (validColumns.includes(sort)) {
        const sortOrder = order === 'asc' ? 1 : -1;
        result.products.sort((a, b) => {
          if (a[sort] < b[sort]) return -1 * sortOrder;
          if (a[sort] > b[sort]) return 1 * sortOrder;
          return 0;
        });
      }
    }

    res.json(result);
  } catch (err) {
    console.error('Error in GET /api/products/performance:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/products/top
 *
 * Query params:
 *   - start (required): YYYY-MM-DD
 *   - end (required): YYYY-MM-DD
 *   - categories (optional): comma-separated category names
 *   - limit (optional): number of top products to return (default 5)
 *
 * Returns top N products by revenue.
 */
router.get('/top', (req, res) => {
  try {
    const { start, end, categories: categoriesParam, limit } = req.query;

    const error = validateDateRange(start, end);
    if (error) {
      return res.status(400).json({ error });
    }

    const categories = parseCategories(categoriesParam);
    const resolvedLimit = limit ? parseInt(limit, 10) : 5;
    const result = productService.getTop(start, end, categories, resolvedLimit);

    res.json(result);
  } catch (err) {
    console.error('Error in GET /api/products/top:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/products/categories
 *
 * Query params:
 *   - start (required): YYYY-MM-DD
 *   - end (required): YYYY-MM-DD
 *   - categories (optional): comma-separated category names
 *
 * Returns category revenue breakdown with percentages.
 */
router.get('/categories', (req, res) => {
  try {
    const { start, end, categories: categoriesParam } = req.query;

    const error = validateDateRange(start, end);
    if (error) {
      return res.status(400).json({ error });
    }

    const categories = parseCategories(categoriesParam);
    const result = productService.getCategories(start, end, categories);

    res.json(result);
  } catch (err) {
    console.error('Error in GET /api/products/categories:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
