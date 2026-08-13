import { useState, useEffect, useRef } from 'react';
import { useFilters } from '../context/FilterContext';
import { getSalesOverview } from '../services/api';

function DateRangePicker() {
  const { filters, setDateRange } = useFilters();
  const [noData, setNoData] = useState(false);
  const mountedRef = useRef(true);

  // Check if current date range has data (lightweight sales overview check)
  useEffect(() => {
    mountedRef.current = true;
    let timer;

    async function checkData() {
      try {
        const res = await getSalesOverview(
          filters.dateRange.start,
          filters.dateRange.end,
          filters.categories
        );
        if (mountedRef.current) {
          const current = res.data?.current;
          setNoData(
            current &&
            current.totalRevenue === 0 &&
            current.totalOrders === 0
          );
        }
      } catch {
        // Don't show banner on network errors — pages handle that
        if (mountedRef.current) setNoData(false);
      }
    }

    // Debounce the check to avoid excessive API calls while user is adjusting dates
    timer = setTimeout(checkData, 300);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, [filters.dateRange.start, filters.dateRange.end, filters.categories]);

  const handleStartChange = (e) => {
    setDateRange(e.target.value, filters.dateRange.end);
  };

  const handleEndChange = (e) => {
    setDateRange(filters.dateRange.start, e.target.value);
  };

  return (
    <div className="date-range-picker">
      <div className="filter-field">
        <label htmlFor="start-date">From</label>
        <input
          type="date"
          id="start-date"
          value={filters.dateRange.start}
          onChange={handleStartChange}
          max={filters.dateRange.end}
        />
      </div>
      <div className="filter-field">
        <label htmlFor="end-date">To</label>
        <input
          type="date"
          id="end-date"
          value={filters.dateRange.end}
          onChange={handleEndChange}
          min={filters.dateRange.start}
        />
      </div>
      {noData && (
        <div className="date-range-no-data" role="status">
          <span className="no-data-icon">ℹ️</span>
          <span>No data for this period. Try adjusting your filters.</span>
        </div>
      )}
    </div>
  );
}

export default DateRangePicker;
