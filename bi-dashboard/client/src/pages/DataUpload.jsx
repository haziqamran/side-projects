import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadCsv, getUploadStatus, triggerSeed } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const EXPECTED_COLUMNS = [
  'date',
  'product',
  'category',
  'quantity',
  'unit_price',
  'customer_id',
  'payment_method',
];

function DataUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // State
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [dbEmpty, setDbEmpty] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check if database has data on mount
  useEffect(() => {
    let cancelled = false;
    async function checkStatus() {
      try {
        const res = await getUploadStatus();
        if (!cancelled) {
          setDbEmpty(!res.data.hasData);
        }
      } catch {
        // Silently ignore status check failure
      } finally {
        if (!cancelled) {
          setCheckingStatus(false);
        }
      }
    }
    checkStatus();
    return () => { cancelled = true; };
  }, []);

  // Validate file client-side
  const validateFile = useCallback((selectedFile) => {
    if (!selectedFile) return 'Please select a file to upload.';
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      return 'Only CSV files are accepted.';
    }
    if (selectedFile.size === 0) {
      return 'File is empty. Please select a CSV with transaction data.';
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      return 'File exceeds maximum size of 10 MB.';
    }
    return null;
  }, []);

  // Handle file selection
  const handleFileSelect = (selectedFile) => {
    setError(null);
    setUploadResult(null);
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setFile(selectedFile);
  };

  // Drag-and-drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const handleInputChange = (e) => {
    handleFileSelect(e.target.files[0]);
  };

  const handleDropzoneClick = () => {
    fileInputRef.current?.click();
  };

  // Upload handler
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const res = await uploadCsv(file);
      setUploadResult(res.data);
      setFile(null);
      setDbEmpty(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Upload failed. Please try again.';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  // Seed handler
  const handleSeed = async () => {
    setSeeding(true);
    setError(null);
    try {
      await triggerSeed();
      navigate('/');
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to generate sample data. Please try again.';
      setError(message);
    } finally {
      setSeeding(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="page">
        <h1>Data Upload</h1>
        <LoadingSpinner text="Checking database status..." />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Data Upload</h1>

      {/* Seed Data Prompt */}
      {dbEmpty && (
        <div className="seed-prompt-card">
          <div className="seed-prompt-icon">🌱</div>
          <h2>No Data Found</h2>
          <p>Your database is empty. Generate sample data to explore the dashboard, or upload your own CSV below.</p>
          <button
            className="seed-btn"
            onClick={handleSeed}
            disabled={seeding}
          >
            {seeding ? 'Generating...' : 'Generate Sample Data'}
          </button>
        </div>
      )}

      {/* Upload Section */}
      <div className="upload-section">
        <h2>Upload CSV File</h2>

        {/* Dropzone */}
        <div
          className={`dropzone ${isDragging ? 'dropzone-active' : ''} ${file ? 'dropzone-has-file' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleDropzoneClick}
          role="button"
          tabIndex={0}
          aria-label="Drop CSV file here or click to browse"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDropzoneClick(); }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleInputChange}
            className="file-input-hidden"
            aria-hidden="true"
          />
          {file ? (
            <div className="dropzone-file-info">
              <span className="dropzone-file-icon">📄</span>
              <span className="dropzone-file-name">{file.name}</span>
              <span className="dropzone-file-size">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          ) : (
            <div className="dropzone-placeholder">
              <span className="dropzone-upload-icon">📁</span>
              <p>Drag & drop a CSV file here, or click to browse</p>
              <p className="dropzone-hint">Maximum file size: 10 MB</p>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <button
          className="upload-btn"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>

        {/* Error Message */}
        {error && (
          <div className="upload-error" role="alert">
            <span className="upload-error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Upload Success */}
        {uploadResult && (
          <div className="upload-success" role="status">
            <span className="upload-success-icon">✅</span>
            <div className="upload-success-details">
              <p className="upload-success-title">Upload Complete</p>
              <p><strong>{uploadResult.imported}</strong> rows imported</p>
              {uploadResult.skipped > 0 && (
                <p><strong>{uploadResult.skipped}</strong> rows skipped (invalid data)</p>
              )}
              {uploadResult.message && <p className="upload-success-message">{uploadResult.message}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Expected Format */}
      <div className="format-section">
        <h3>Expected CSV Format</h3>
        <p>Your CSV file should include the following columns:</p>
        <div className="format-columns">
          {EXPECTED_COLUMNS.map((col) => (
            <span key={col} className="format-column-tag">{col}</span>
          ))}
        </div>
        <div className="format-example">
          <p className="format-example-title">Example row:</p>
          <code>2024-01-15,Latte,Beverages,2,4.50,CUST-001,Credit Card</code>
        </div>
      </div>
    </div>
  );
}

export default DataUpload;
