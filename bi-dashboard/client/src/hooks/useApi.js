import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook that wraps an async API call with loading/error/data state.
 * Automatically refetches when dependencies change.
 *
 * @param {Function} apiCall - Function that returns a promise (axios response)
 * @param {Array} deps - Dependency array that triggers refetch on change
 * @returns {{ data: any, loading: boolean, error: any, refetch: Function }}
 */
export function useApi(apiCall, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall();
      if (mountedRef.current) {
        setData(response.data);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.response?.data?.error || err.message || 'An error occurred');
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => {
      mountedRef.current = false;
    };
  }, [fetch]);

  const refetch = useCallback(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch };
}

export default useApi;
