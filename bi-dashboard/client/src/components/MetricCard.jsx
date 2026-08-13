/**
 * MetricCard – displays a single KPI with title, formatted value, and
 * period-over-period change percentage.
 *
 * Props:
 *  - title: string – label displayed above the value
 *  - value: number|string – the metric value to display
 *  - change: number|null – percentage change vs previous period
 *  - prefix: string – prepended to value (e.g. "$")
 *  - suffix: string – appended to value (e.g. "%")
 */

const styles = {
  card: {
    background: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    padding: '24px',
    minWidth: '200px',
    flex: '1 1 0',
  },
  title: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.75rem',
  },
  value: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '0.5rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
  },
  changeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
  },
};

/**
 * Format a numeric value with locale formatting (commas, decimals).
 */
function formatValue(value) {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Get the color for the change indicator.
 */
function getChangeColor(change) {
  if (change == null) return '#9CA3AF';
  if (change > 0) return '#059669';
  if (change < 0) return '#DC2626';
  return '#9CA3AF';
}

export default function MetricCard({ title, value, change, prefix = '', suffix = '' }) {
  const changeColor = getChangeColor(change);
  const changeText =
    change == null
      ? 'N/A'
      : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;

  return (
    <div style={styles.card}>
      <div style={styles.title}>{title}</div>
      <div style={styles.value}>
        {prefix}{formatValue(value)}{suffix}
      </div>
      <div style={styles.changeRow}>
        <span style={{ ...styles.dot, backgroundColor: changeColor }} />
        <span style={{ color: changeColor }}>{changeText}</span>
        <span style={{ color: '#9CA3AF', fontWeight: 400 }}>
          vs prev period
        </span>
      </div>
    </div>
  );
}
