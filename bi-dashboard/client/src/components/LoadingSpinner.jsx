/**
 * LoadingSpinner – CSS-based loading indicator with optional text.
 * Centered in its container, used while API calls are in progress.
 *
 * Props:
 *  - text: string (default "Loading...") – optional message below spinner
 */

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    width: '100%',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid #E5E7EB',
    borderTopColor: '#3B82F6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  text: {
    marginTop: '0.75rem',
    fontSize: '0.875rem',
    color: '#6B7280',
    fontWeight: 500,
  },
};

// Inject keyframes once via a <style> tag
const keyframes = `@keyframes spin { to { transform: rotate(360deg); } }`;

export default function LoadingSpinner({ text = 'Loading...' }) {
  return (
    <>
      <style>{keyframes}</style>
      <div style={styles.container} role="status" aria-live="polite">
        <div style={styles.spinner} />
        {text && <p style={styles.text}>{text}</p>}
      </div>
    </>
  );
}
