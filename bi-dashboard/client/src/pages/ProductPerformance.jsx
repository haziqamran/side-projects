import { useState, useMemo } from 'react';
import { useFilters } from '../context/FilterContext';
import { useApi } from '../hooks/useApi';
import { getProductPerformance } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import TrendBadge from '../components/TrendBadge';

/**
 * Formats a number as USD currency with comma separators.
 * e.g. 12500 -> "$12,500.00"
 */
function formatRevenue(value) {
  return '$' + Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * ProductPerformance page – displays a sortable product table with
 * revenue, units sold, trend indicators, and slow-moving product flags.
 * Connects to FilterContext for date range and category filtering.
 */
function ProductPerformance() {
  const { filters } = useFilters();
  const { dateRange, categories } = filters;

  // Sortable table state: column key and direction
  const [sortColumn, setSortColumn] = useState('totalRevenue');
  const [sortDirection, setSortDirection] = useState('desc');

  // Fetch product performance data, refetch when filters change
  const { data, loading, error, refetch } = useApi(
    () => getProductPerformance(dateRange.start, dateRange.end, categories),
    [dateRange.start, dateRange.end, categories]
  );

  /**
   * Toggle sort: if same column clicked, flip direction.
   * If new column, sort ascending first.
   */
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort the products based on current sort state
  const sortedProducts = useMemo(() => {
    if (!data?.products) return [];

    return [...data.products].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];

      // String comparison for product name and category
      if (sortColumn === 'product' || sortColumn === 'category' || sortColumn === 'trend') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }

      // Numeric comparison
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortColumn, sortDirection]);

  // Render sort indicator for column headers
  const renderSortIndicator = (column) => {
    if (sortColumn !== column) return null;
    return (
      <span className="sort-indicator" aria-label={sortDirection === 'asc' ? 'sorted ascending' : 'sorted descending'}>
        {sortDirection === 'asc' ? ' ▲' : ' ▼'}
      </span>
    );
  };

  // Column definitions for the table
  const columns = [
    { key: 'product', label: 'Product' },
    { key: 'category', label: 'Category' },
    { key: 'totalRevenue', label: 'Revenue' },
    { key: 'unitsSold', label: 'Units Sold' },
    { key: 'trend', label: 'Trend' },
  ];

  if (loading) {
    return (
      <div className="page">
        <h1>Product Performance</h1>
        <LoadingSpinner text="Loading product data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>Product Performance</h1>
        <div className="error-state" role="alert">
          <p className="error-state-message">⚠️ Error loading products: {error}</p>
          <p className="error-state-hint">Try adjusting your filters or check your connection.</p>
          <button className="retry-btn" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  if (!data?.products || data.products.length === 0) {
    return (
      <div className="page">
        <h1>Product Performance</h1>
        <div className="empty-state" role="status">
          <p className="empty-state-message">No data for this period. Try adjusting your filters.</p>
        </div>
      </div>
    );
  }

  const slowMovingThreshold = data.slowMovingThreshold;
  const hasSlowMovers = sortedProducts.some((p) => p.isSlowMoving);

  return (
    <div className="page">
      <h1>Product Performance</h1>

      {/* Slow-moving products summary */}
      <div className="slow-mover-summary">
        {hasSlowMovers ? (
          <p className="slow-mover-notice">
            ⚠️ Some products are flagged as slow-moving (below {slowMovingThreshold} units threshold).
          </p>
        ) : (
          <p className="slow-mover-clear">
            No slow-moving products identified for the current filters
          </p>
        )}
      </div>

      {/* Sortable product table */}
      <div className="product-table-container">
        <table className="product-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`sortable-header ${sortColumn === col.key ? 'active-sort' : ''}`}
                  onClick={() => handleSort(col.key)}
                  aria-sort={
                    sortColumn === col.key
                      ? sortDirection === 'asc' ? 'ascending' : 'descending'
                      : 'none'
                  }
                >
                  {col.label}
                  {renderSortIndicator(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((product, index) => (
              <tr
                key={`${product.product}-${index}`}
                className={product.isSlowMoving ? 'slow-mover-row' : ''}
              >
                <td className="product-name-cell">
                  {product.isSlowMoving && (
                    <span className="slow-mover-icon" title="Slow-moving product">⚠️</span>
                  )}
                  {product.product}
                </td>
                <td>{product.category}</td>
                <td className="revenue-cell">{formatRevenue(product.totalRevenue)}</td>
                <td className="units-cell">
                  {product.unitsSold.toLocaleString()}
                  {product.isSlowMoving && (
                    <span className="threshold-text">
                      Below threshold ({slowMovingThreshold} units)
                    </span>
                  )}
                </td>
                <td>
                  <TrendBadge trend={product.trend} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProductPerformance;
