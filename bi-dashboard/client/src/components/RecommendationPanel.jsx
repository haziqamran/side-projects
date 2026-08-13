import { useFilters } from '../context/FilterContext';
import { useApi } from '../hooks/useApi';
import { getRecommendations } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

const styles = {
  panel: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    marginTop: '1.5rem',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderLeft: '3px solid #3B82F6',
    borderRadius: '0.25rem',
    background: '#F9FAFB',
  },
  icon: {
    fontSize: '1.25rem',
    lineHeight: '1.5',
    flexShrink: 0,
  },
  text: {
    fontSize: '0.9rem',
    color: '#374151',
    lineHeight: '1.5',
    margin: 0,
  },
  insufficientData: {
    fontSize: '0.875rem',
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: '0.75rem',
  },
  error: {
    color: '#DC2626',
    fontSize: '0.875rem',
  },
};

/**
 * RecommendationPanel – Displays plain-English business insights
 * fetched from the recommendations API. Refetches when filters change.
 */
export default function RecommendationPanel() {
  const { filters } = useFilters();
  const { dateRange, categories } = filters;

  const { data, loading, error, refetch } = useApi(
    () => getRecommendations(dateRange.start, dateRange.end, categories),
    [dateRange.start, dateRange.end, categories]
  );

  if (loading) {
    return (
      <div style={styles.panel}>
        <LoadingSpinner text="Generating recommendations..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.panel}>
        <p style={styles.error}>⚠️ Failed to load recommendations: {error}</p>
        <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.5rem' }}>
          Try adjusting your filters or check your connection.
        </p>
        <button
          onClick={refetch}
          style={{
            marginTop: '0.75rem',
            padding: '0.5rem 1rem',
            background: '#3B82F6',
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const recommendations = data?.recommendations || [];
  const insufficientData = data?.insufficientData || false;

  return (
    <div style={styles.panel}>
      {recommendations.length > 0 ? (
        <ul style={styles.list}>
          {recommendations.map((rec, index) => (
            <li key={index} style={styles.item}>
              <span style={styles.icon} aria-hidden="true">💡</span>
              <p style={styles.text}>{rec}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p style={styles.text}>No data for this period. Try adjusting your filters.</p>
      )}

      {insufficientData && (
        <p style={styles.insufficientData}>
          Insufficient data for more recommendations.
        </p>
      )}
    </div>
  );
}
