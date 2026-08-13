/**
 * MetricCard – displays a single KPI with title, formatted value, and
 * period-over-period change percentage. Change is color-coded:
 * green for positive, red for negative, gray for null/N/A.
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
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
    padding: '1.5rem',
    minWidth: '200px',
    flex: '1 1 0',
  },
  title: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.025em',
    marginBottom: '0.5rem',
  },
  value: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#1a202c',
    marginBottom: '0.5rem',
  },
  changeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
};

/**
 * Format a numeric value with locale formatting (commas, decimals).
 * Returns the value as-is if it's already a string.
 */
function formatValue(value) {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  // Format numbers with up to 2 decimal places
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Determine the color for the change indicator based on direction.
 */
function getChangeColor(change) {
  if (change == null) return '#6B7280'; // gray
  if (change > 0) return '#10B981';     // green
  if (change < 0) return '#EF4444';     // red
  return '#6B7280';                     // gray for zero
}

/**
 * Get the arrow character for the change direction.
 */
function getChangeArrow(change) {
  if (change == null) return '';
  if (change > 0) return '↑';
  if (change < 0) return '↓';
  return '–';
}

export default function MetricCard({ title, value, change, prefix = '', suffix = '' }) {
  const changeColor = getChangeColor(change);
  const arrow = getChangeArrow(change);
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
      <div style={{ ...styles.changeRow, color: changeColor }}>
        {arrow && <span>{arrow}</span>}
        <span>{changeText}</span>
        <span style={{ color: '#9CA3AF', fontWeight: 400, marginLeft: '0.25rem' }}>
          vs prev period
        </span>
      </div>
    </div>
  );
}
