/**
 * TrendBadge – compact inline badge indicating trend direction.
 * Designed for use in table cells to show product performance trend.
 *
 * Props:
 *  - trend: "up" | "down" | "stable"
 */

const badgeStyles = {
  up: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  down: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  stable: {
    backgroundColor: '#F3F4F6',
    color: '#4B5563',
  },
};

const icons = {
  up: '↑',
  down: '↓',
  stable: '–',
};

const labels = {
  up: 'Up',
  down: 'Down',
  stable: 'Stable',
};

const baseStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.2rem 0.5rem',
  borderRadius: '9999px',
  fontSize: '0.75rem',
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: 'nowrap',
};

export default function TrendBadge({ trend = 'stable' }) {
  const variant = badgeStyles[trend] || badgeStyles.stable;
  const icon = icons[trend] || icons.stable;
  const label = labels[trend] || labels.stable;

  return (
    <span style={{ ...baseStyle, ...variant }} aria-label={`Trend: ${label}`}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
