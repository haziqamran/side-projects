/**
 * Upload Routes
 *
 * POST /api/upload       — Upload a CSV file (multipart, max 10 MB)
 * GET  /api/upload/status — Check if database has data
 * POST /api/seed         — Trigger seed data generation
 */
const express = require('express');
const multer = require('multer');
const uploadService = require('../services/uploadService');
const { transactionCount } = require('../models/queries');
const { getPool } = require('../db');
const { seedDatabase } = require('../seedDatabase');

const router = express.Router();

// Configure multer: memory storage, 10 MB limit, single file with field name "file"
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

/**
 * POST /api/upload
 * Accepts a single CSV file upload and processes it via uploadService.
 * Wraps multer to catch its file-size errors before they bubble up.
 */
router.post('/upload', (req, res) => {
  upload.single('file')(req, res, async (multerErr) => {
    // Handle multer errors (e.g., file too large)
    if (multerErr) {
      if (multerErr instanceof multer.MulterError && multerErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File exceeds maximum size of 10 MB' });
      }
      return res.status(400).json({ error: multerErr.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { buffer, originalname, size } = req.file;
      const result = await uploadService.processUpload(buffer, originalname, size);

      return res.status(200).json({
        success: true,
        imported: result.imported,
        skipped: result.skipped,
        message: result.message
      });
    } catch (err) {
      // Map known error messages to appropriate HTTP status codes
      const message = err.message || 'Internal server error';

      if (message.includes('Missing required columns')) {
        return res.status(400).json({ error: message });
      }
      if (message.includes('File contains no transaction data')) {
        return res.status(400).json({ error: message });
      }
      if (message.includes('File exceeds maximum size')) {
        return res.status(413).json({ error: message });
      }
      if (message.includes('Only CSV files are accepted')) {
        return res.status(400).json({ error: message });
      }

      // Unexpected errors
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
});

/**
 * GET /api/upload/status
 * Returns whether the database has any transaction data.
 */
router.get('/upload/status', async (req, res) => {
  try {
    const pool = getPool();
    const { sql, params } = transactionCount();
    const result = await pool.query(sql, params);
    const hasData = parseInt(result.rows[0].count, 10) > 0;

    return res.status(200).json({ hasData });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/seed
 * Triggers seed data generation (~5,500 sample transaction records).
 */
router.post('/seed', async (req, res) => {
  try {
    const result = await seedDatabase();
    return res.status(200).json({
      success: true,
      message: `Seeded ${result.count} transaction records`
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
