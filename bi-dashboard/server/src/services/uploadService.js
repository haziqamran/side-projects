/**
 * Upload Service — handles CSV file ingestion and validation.
 *
 * Responsibilities:
 *   1. File-level validation: type (CSV), size (≤10 MB), required columns present
 *   2. Row-level validation: non-empty fields, positive numeric quantity/unit_price, YYYY-MM-DD date
 *   3. Batch insert of valid rows via a single transaction (append-only)
 *   4. Returns import summary { imported, skipped, message }
 *
 * Throws descriptive errors for file-level failures (wrong type, too large, missing columns, empty file).
 */

const { parse } = require('csv-parse/sync');
const { getDb } = require('../db');

// Maximum file size: 10 MB in bytes
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Required columns in the database (normalized form)
const REQUIRED_COLUMNS = [
  'date',
  'product',
  'category',
  'quantity',
  'unit_price',
  'customer_id',
  'payment_method'
];

/**
 * Normalizes a CSV column header to match database column names.
 * Trims whitespace, converts to lowercase, and replaces spaces with underscores.
 *
 * Examples: "Unit Price" → "unit_price", "Customer ID" → "customer_id"
 *
 * @param {string} header - Raw CSV column header
 * @returns {string} Normalized column name
 */
function normalizeColumnName(header) {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Validates that a date string matches the YYYY-MM-DD format and represents
 * a valid calendar date.
 *
 * @param {string} value - The date string to validate
 * @returns {boolean} True if valid YYYY-MM-DD date
 */
function isValidDate(value) {
  // Check format strictly: exactly YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) return false;

  // Verify it's a real calendar date (e.g., reject 2024-02-30)
  const [year, month, day] = value.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day
  );
}

/**
 * Validates that a value is a positive number (integer or float > 0).
 *
 * @param {string} value - The string value to check
 * @returns {boolean} True if value is numeric and positive
 */
function isPositiveNumber(value) {
  const num = Number(value);
  return !isNaN(num) && isFinite(num) && num > 0;
}

/**
 * Validates a single row of transaction data.
 * A row is invalid if any required field is empty, quantity is not a positive number,
 * unit_price is not a positive number, or date does not match YYYY-MM-DD format.
 *
 * @param {object} row - Object with normalized column keys
 * @returns {boolean} True if the row passes all validations
 */
function isValidRow(row) {
  // Check all required fields are non-empty (after trimming)
  for (const col of REQUIRED_COLUMNS) {
    const value = row[col];
    if (value === undefined || value === null || String(value).trim() === '') {
      return false;
    }
  }

  // Validate date format: YYYY-MM-DD
  if (!isValidDate(String(row.date).trim())) {
    return false;
  }

  // Validate quantity: must be a positive number
  if (!isPositiveNumber(String(row.quantity).trim())) {
    return false;
  }

  // Validate unit_price: must be a positive number
  if (!isPositiveNumber(String(row.unit_price).trim())) {
    return false;
  }

  return true;
}

/**
 * Processes a CSV file buffer: validates structure and rows, inserts valid rows
 * into the database within a single transaction (append-only).
 *
 * @param {Buffer} fileBuffer - Raw file content
 * @param {string} originalName - Original filename (used for type checking)
 * @param {number} fileSize - File size in bytes
 * @returns {{ imported: number, skipped: number, message: string }}
 * @throws {Error} For file-level failures with descriptive messages
 */
function processUpload(fileBuffer, originalName, fileSize) {
  // 1. File type validation — only CSV files accepted
  if (!originalName || !originalName.toLowerCase().endsWith('.csv')) {
    throw new Error('Only CSV files are accepted');
  }

  // 2. File size validation — must not exceed 10 MB
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error('File exceeds maximum size of 10 MB');
  }

  // 3. Parse CSV content
  const content = fileBuffer.toString('utf-8');

  let records;
  try {
    records = parse(content, {
      columns: (headers) => headers.map(normalizeColumnName),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });
  } catch (err) {
    throw new Error('Failed to parse CSV file: ' + err.message);
  }

  // 4. Column presence validation — check that all required columns exist
  if (records.length === 0) {
    // If there are no records, either the file has no header or no data rows.
    // Try to parse just the header to check columns.
    const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length === 0) {
      throw new Error('File contains no transaction data');
    }
    // Has header but no data rows
    const headers = lines[0].split(',').map(normalizeColumnName);
    const missingCols = REQUIRED_COLUMNS.filter(
      (col) => !headers.includes(col)
    );
    if (missingCols.length > 0) {
      throw new Error('Missing required columns: ' + missingCols.join(', '));
    }
    // Header is valid but no data rows
    throw new Error('File contains no transaction data');
  }

  // Check columns from the first record's keys
  const presentColumns = Object.keys(records[0]);
  const missingColumns = REQUIRED_COLUMNS.filter(
    (col) => !presentColumns.includes(col)
  );
  if (missingColumns.length > 0) {
    throw new Error('Missing required columns: ' + missingColumns.join(', '));
  }

  // 5. Row-level validation and batch insert
  const db = getDb();
  const insertStmt = db.prepare(`
    INSERT INTO transactions (date, product, category, quantity, unit_price, customer_id, payment_method)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skipped = 0;

  // Use a transaction for batch insert — all-or-nothing for performance,
  // but we only insert valid rows (invalid ones are silently skipped).
  const insertAll = db.transaction((rows) => {
    for (const row of rows) {
      if (isValidRow(row)) {
        insertStmt.run(
          String(row.date).trim(),
          String(row.product).trim(),
          String(row.category).trim(),
          Number(String(row.quantity).trim()),
          Number(String(row.unit_price).trim()),
          String(row.customer_id).trim(),
          String(row.payment_method).trim()
        );
        imported++;
      } else {
        skipped++;
      }
    }
  });

  insertAll(records);

  // 6. Build result summary
  const message = `${imported} valid rows imported, ${skipped} rows skipped due to invalid data`;

  return { imported, skipped, message };
}

module.exports = {
  processUpload,
  // Exported for testing purposes
  normalizeColumnName,
  isValidDate,
  isPositiveNumber,
  isValidRow,
  REQUIRED_COLUMNS,
  MAX_FILE_SIZE
};
