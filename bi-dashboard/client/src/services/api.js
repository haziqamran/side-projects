import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

/**
 * Build query params from common filter values.
 * Omits categories param if the array is empty (meaning "all").
 */
function buildParams(start, end, categories, extra = {}) {
  const params = { start, end, ...extra };
  if (categories && categories.length > 0) {
    params.categories = categories.join(',');
  }
  return params;
}

// --- Sales ---

export function getSalesOverview(start, end, categories) {
  return api.get('/sales/overview', { params: buildParams(start, end, categories) });
}

export function getSalesTrend(start, end, categories, granularity) {
  return api.get('/sales/trend', {
    params: buildParams(start, end, categories, { granularity }),
  });
}

// --- Products ---

export function getProductPerformance(start, end, categories) {
  return api.get('/products/performance', { params: buildParams(start, end, categories) });
}

export function getProductTop(start, end, categories, limit = 5) {
  return api.get('/products/top', {
    params: buildParams(start, end, categories, { limit }),
  });
}

export function getProductCategories(start, end, categories) {
  return api.get('/products/categories', { params: buildParams(start, end, categories) });
}

// --- Customers ---

export function getCustomerInsights(start, end, categories) {
  return api.get('/customers/insights', { params: buildParams(start, end, categories) });
}

// --- Recommendations ---

export function getRecommendations(start, end, categories) {
  return api.get('/recommendations', { params: buildParams(start, end, categories) });
}

// --- Upload ---

export function uploadCsv(file) {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function getUploadStatus() {
  return api.get('/upload/status');
}

// --- Seed ---

export function triggerSeed() {
  return api.post('/seed');
}

// --- Categories (for filter dropdown) ---

export function getCategories() {
  return api.get('/products/categories');
}

export default api;
