import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useFilters } from '../context/FilterContext';
import { getSalesOverview, getSalesTrend, getProductTop, getProductCategories } from '../services/api';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

/**
 * SalesOverview page – displays aggregate sales metrics, revenue trend line chart,
 * top products bar chart, and category donut chart. All data responds to global filters.
 */
export default function SalesOverview() {
  const { filters, setGranularity } = useFilters();
  const { dateRange, categories, granularity } = filters;

  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Fetch all data when filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function fetchData() {
      try {
        const [overviewRes, trendRes, topRes, catRes] = await Promise.all([
          getSalesOverview(dateRange.start, dateRange.end, categories),
          getSalesTrend(dateRange.start, dateRange.end, categories, granularity),
          getProductTop(dateRange.start, dateRange.end, categories),
          getProductCategories(dateRange.start, dateRange.end, categories),
        ]);

        if (!cancelled) {
          setOverview(overviewRes.data);
          setTrend(trendRes.data);
          setTopProducts(topRes.data);
          setCategoryData(catRes.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message || 'Failed to load data');
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [dateRange.start, dateRange.end, categories, granularity, retryCount]);

  if (loading) {
    return (
      <div className="page">
        <h1>Sales Overview</h1>
        <LoadingSpinner text="Loading sales data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>Sales Overview</h1>
        <div className="error-state" role="alert">
          <p className="error-state-message">⚠️ {error}</p>
          <p className="error-state-hint">Try adjusting your filters or check your connection.</p>
          <button className="retry-btn" onClick={() => setRetryCount((c) => c + 1)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Check if there's no data
  const hasNoData = overview && overview.current &&
    overview.current.totalRevenue === 0 &&
    overview.current.totalOrders === 0;

  if (hasNoData) {
    return (
      <div className="page">
        <h1>Sales Overview</h1>
        <div className="empty-state" role="status">
          <p className="empty-state-message">No data for this period. Try adjusting your filters.</p>
        </div>
      </div>
    );
  }

  // Prepare trend data for line chart
  const trendData = trend?.trend || trend || [];

  // Prepare top products data for bar chart
  const topProductsData = topProducts?.products || topProducts || [];

  // Prepare category data for donut chart
  const categoryChartData = prepareCategoryData(categoryData);

  return (
    <div className="page">
      <h1>Sales Overview</h1>

      {/* Metric Cards Row */}
      <div className="metrics-row">
        <MetricCard
          title="Total Revenue"
          value={overview?.current?.totalRevenue}
          change={overview?.change?.totalRevenue}
          prefix="$"
        />
        <MetricCard
          title="Total Orders"
          value={overview?.current?.totalOrders}
          change={overview?.change?.totalOrders}
        />
        <MetricCard
          title="Average Order Value"
          value={overview?.current?.avgOrderValue}
          change={overview?.change?.avgOrderValue}
          prefix="$"
        />
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Revenue Line Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h2 className="chart-title">Revenue Trend</h2>
            <GranularityToggle value={granularity} onChange={setGranularity} />
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  tickLine={false}
                  tickFormatter={(v) => `$${v.toLocaleString()}`}
                />
                <Tooltip content={<RevenueTrendTooltip />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#3B82F6' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products Bar Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h2 className="chart-title">Top Products by Revenue</h2>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={topProductsData}
                layout="vertical"
                margin={{ top: 5, right: 20, bottom: 5, left: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  tickFormatter={(v) => `$${v.toLocaleString()}`}
                />
                <YAxis
                  type="category"
                  dataKey="product"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  width={75}
                />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Donut Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h2 className="chart-title">Sales by Category</h2>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value.toFixed(1)}%`, name]}
                />
                <Legend
                  formatter={(value) => {
                    const item = categoryChartData.find(d => d.name === value);
                    return `${value} (${item ? item.value.toFixed(1) : 0}%)`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Prepare category data for the donut chart.
 * Converts API response into { name, value (percentage) } array.
 */
function prepareCategoryData(data) {
  if (!data) return [];
  // Handle array format: [{ category, revenue, percentage }]
  if (Array.isArray(data)) {
    return data.map(item => ({
      name: item.category || item.name,
      value: item.percentage != null ? item.percentage : item.value || 0,
    }));
  }
  // Handle object format: { categories: [...] }
  if (data.categories && Array.isArray(data.categories)) {
    return data.categories.map(item => ({
      name: item.category || item.name,
      value: item.percentage != null ? item.percentage : item.value || 0,
    }));
  }
  return [];
}

/**
 * Custom tooltip for the revenue trend line chart.
 * Displays period label and exact revenue value.
 */
function RevenueTrendTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      <p className="chart-tooltip-value">
        Revenue: ${Number(payload[0].value).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
    </div>
  );
}

/**
 * GranularityToggle – button group to switch between daily/weekly/monthly.
 * Updates the global FilterContext granularity.
 */
function GranularityToggle({ value, onChange }) {
  const options = ['daily', 'weekly', 'monthly'];
  return (
    <div className="granularity-toggle">
      {options.map(opt => (
        <button
          key={opt}
          className={`granularity-btn ${value === opt ? 'active' : ''}`}
          onClick={() => onChange(opt)}
          type="button"
        >
          {opt.charAt(0).toUpperCase() + opt.slice(1)}
        </button>
      ))}
    </div>
  );
}
