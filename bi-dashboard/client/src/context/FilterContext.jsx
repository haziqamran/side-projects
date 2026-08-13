import { createContext, useContext, useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';

const FilterContext = createContext(null);

/**
 * Compute default date range: last 30 days from today.
 */
function getDefaultDateRange() {
  const end = new Date();
  const start = subDays(end, 29); // 30 days inclusive
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

export function FilterProvider({ children }) {
  const [dateRange, setDateRangeState] = useState(getDefaultDateRange);
  const [categories, setCategories] = useState([]);
  const [granularity, setGranularity] = useState('daily');

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
