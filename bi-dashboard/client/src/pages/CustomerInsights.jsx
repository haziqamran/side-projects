import { useFilters } from '../context/FilterContext';
import { useApi } from '../hooks/useApi';
import { getCustomerInsights } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * CustomerInsights page – displays repeat customer rate, top 10 customers
 * by spend, and customer segmentation (Active vs At-Risk).
 *
 * Connects to FilterContext for date range and category filters.
 * Refetches data automatically when filters change.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
function CustomerInsights() {
  const { filters } = useFilters();
  const { dateRange, categories } = filters;

  const { data, loading, error, refetch } = useApi(
    () => getCustomerInsights(dateRange.start, dateRange.end, categories),
    [dateRange.start, dateRange.end, categories]
  );

  if (loading) {
    return (
      <div className="page">
        <h1>Customer Insights</h1>
        <LoadingSpinner text="Loading customer insights..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>Customer Insights</h1>
        <div className="error-state" role="alert">
          <p className="error-state-message">⚠️ Error loading customer data: {error}</p>
          <p className="error-state-hint">Try adjusting your filters or check your connection.</p>
          <button className="retry-btn" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  // Empty state: no customers at all
  const hasCustomers = data && data.topCustomers && data.topCustomers.length > 0;
  const hasRepeatData = data && data.repeatRate && (data.repeatRate.repeat > 0 || data.repeatRate.oneTime > 0);

  if (!hasCustomers && !hasRepeatData) {
    return (
      <div className="page">
        <h1>Customer Insights</h1>
        <div className="empty-state" role="status">
          <p className="empty-state-message">
            No data for this period. Try adjusting your filters.
          </p>
        </div>
      </div>
    );
  }

  const { repeatRate, topCustomers, segments } = data;

  return (
    <div className="page">
      <h1>Customer Insights</h1>

      <div className="customer-insights-grid">
        {/* Repeat Rate Card */}
        <div className="insight-card">
          <h2 className="insight-card-title">Repeat vs One-Time Customers</h2>
          <div className="repeat-rate-display">
            <div className="rate-item">
              <span className="rate-label">Repeat Customers</span>
              <div className="rate-bar-container">
                <div
                  className="rate-bar rate-bar--repeat"
                  style={{ width: `${repeatRate.repeat}%` }}
                />
              </div>
              <span className="rate-value">{repeatRate.repeat}%</span>
            </div>
            <div className="rate-item">
              <span className="rate-label">One-Time Customers</span>
              <div className="rate-bar-container">
                <div
                  className="rate-bar rate-bar--onetime"
                  style={{ width: `${repeatRate.oneTime}%` }}
                />
              </div>
              <span className="rate-value">{repeatRate.oneTime}%</span>
            </div>
          </div>
        </div>

        {/* Customer Segmentation Card */}
        <div className="insight-card">
          <h2 className="insight-card-title">Customer Segmentation</h2>
          <div className="segments-display">
            <div className="segment-card segment-card--active">
              <span className="segment-label">Active</span>
              <span className="segment-count">{segments.active.count}</span>
              <span className="segment-percentage">{segments.active.percentage}% of customers</span>
              <span className="segment-description">Last purchase within 30 days</span>
            </div>
            <div className="segment-card segment-card--at-risk">
              <span className="segment-label">At Risk</span>
              <span className="segment-count">{segments.atRisk.count}</span>
              <span className="segment-percentage">{segments.atRisk.percentage}% of customers</span>
              <span className="segment-description">No purchase in 60+ days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Customers Table */}
      <div className="insight-card insight-card--full">
        <h2 className="insight-card-title">
          Top {topCustomers.length} Customers by Spend
        </h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer ID</th>
                <th>Total Spend ($)</th>
                <th>Purchases</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((customer, index) => (
                <tr key={customer.customerId}>
                  <td>{index + 1}</td>
                  <td>{customer.customerId}</td>
                  <td>${customer.totalSpend.toFixed(2)}</td>
                  <td>{customer.purchases}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CustomerInsights;
