import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useFilters } from '../context/FilterContext';
import { getSalesOverview, getSalesTrend, getProductTop, getProductCategories } from '../services/api';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';

const CHART_COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

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
        {/* Revenue Area Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h2 className="chart-title">Revenue Trend</h2>
            <GranularityToggle value={granularity} onChange={setGranularity} />
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v.toLocaleString()}`}
                />
                <Tooltip content={<RevenueTrendTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4F46E5"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#4F46E5', strokeWidth: 0 }}
                />
              </AreaChart>
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
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(v) => `$${v.toLocaleString()}`}
                />
                <YAxis
                  type="category"
                  dataKey="product"
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                  width={75}
                />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                  contentStyle={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    boxShadow: 'none',
                  }}
                />
                <Bar dataKey="revenue" fill="#4F46E5" radius={[0, 6, 6, 0]} />
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
                  innerRadius="70%"
                  outerRadius="90%"
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value.toFixed(1)}%`, name]}
                  contentStyle={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    boxShadow: 'none',
                  }}
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
 */
function prepareCategoryData(data) {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map(item => ({
      name: item.category || item.name,
      value: item.percentage != null ? item.percentage : item.value || 0,
    }));
  }
  if (data.categories && Array.isArray(data.categories)) {
    return data.categories.map(item => ({
      name: item.category || item.name,
      value: item.percentage != null ? item.percentage : item.value || 0,
    }));
  }
  return [];
}

/**
 * Custom tooltip for the revenue trend area chart.
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
