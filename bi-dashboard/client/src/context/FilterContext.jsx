import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import axios from 'axios';

const FilterContext = createContext(null);

/**
 * Compute fallback date range: last 30 days from today.
 * Used only until the actual latest transaction date is fetched from the API.
 */
function getDefaultDateRange() {
  const end = new Date();
  const start = subDays(end, 29);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

export function FilterProvider({ children }) {
  const [dateRange, setDateRangeState] = useState(getDefaultDateRange);
  const [categories, setCategories] = useState([]);
  const [granularity, setGranularity] = useState('daily');
  const [initialized, setInitialized] = useState(false);

  /**
   * On mount, fetch the date range of available data from the DB and set the
   * default date range to the most recent 30 days relative to the max date.
   * This ensures the dashboard shows data even when seed data is in the future/past.
   */
  useEffect(() => {
    async function fetchLatestDate() {
      try {
        const res = await axios.get('/api/sales/date-range');
        const { maxDate } = res.data;
        if (maxDate) {
          const endDate = new Date(maxDate + 'T00:00:00');
          const startDate = subDays(endDate, 29);
          setDateRangeState({
            start: format(startDate, 'yyyy-MM-dd'),
            end: format(endDate, 'yyyy-MM-dd'),
          });
        }
      } catch {
        // Keep default range on error
      } finally {
        setInitialized(true);
      }
    }
    fetchLatestDate();
  }, []);

  const setDateRange = (start, end) => {
    setDateRangeState({ start, end });
  };

  const value = useMemo(
    () => ({
      filters: { dateRange, categories, granularity },
      setDateRange,
      setCategories,
      setGranularity,
    }),
    [dateRange, categories, granularity]
  );

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}

export default FilterContext;
