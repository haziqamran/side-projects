/**
 * Recommendation Routes
 *
 * Provides endpoint for plain-English business recommendations
 * generated from sales data analysis.
 *
 * Routes:
 *   GET /api/recommendations — actionable insights based on sales trends
 */
const express = require('express');
const router = express.Router();
const recommendationService = require('../services/recommendationService');

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
 * GET /api/recommendations
 *
 * Query params:
 *   - start (required): YYYY-MM-DD
 *   - end (required): YYYY-MM-DD
 *   - categories (optional): comma-separated category names
 *
 * Returns plain-English business recommendations and insufficientData flag.
 */
router.get('/', async (req, res) => {
  try {
    const { start, end, categories: categoriesParam } = req.query;

    const error = validateDateRange(start, end);
    if (error) {
      return res.status(400).json({ error });
    }

    const categories = parseCategories(categoriesParam);
    const result = await recommendationService.getRecommendations(start, end, categories);

    res.json(result);
  } catch (err) {
    console.error('Error in GET /api/recommendations:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
