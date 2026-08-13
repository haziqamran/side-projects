import { useState, useEffect } from 'react';
import { useFilters } from '../context/FilterContext';
import { getCategories } from '../services/api';

function CategoryFilter() {
  const { filters, setCategories } = useFilters();
  const [availableCategories, setAvailableCategories] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await getCategories();
        // The categories endpoint returns category breakdown data
        // Extract category names from the response
        const cats = Array.isArray(response.data)
          ? response.data.map((item) => item.category || item.name || item)
          : response.data.categories
            ? response.data.categories.map((item) => item.category || item.name || item)
            : [];
        setAvailableCategories(cats);
      } catch (err) {
        // Silently handle — categories will just be empty
        setAvailableCategories([]);
      }
    }
    fetchCategories();
  }, []);

  const handleToggle = (category) => {
    const current = filters.categories;
    if (current.includes(category)) {
      setCategories(current.filter((c) => c !== category));
    } else {
      setCategories([...current, category]);
    }
  };

  const handleClearAll = () => {
    setCategories([]);
  };

  const selectedLabel =
    filters.categories.length === 0
      ? 'All Categories'
      : `${filters.categories.length} selected`;

  return (
    <div className="category-filter">
      <div className="filter-field">
        <label>Category</label>
        <button
          type="button"
          className="category-filter-toggle"
          onClick={() => setIsOpen(!isOpen)}
        >
          {selectedLabel}
          <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
        </button>
      </div>
      {isOpen && (
        <div className="category-dropdown">
          {filters.categories.length > 0 && (
            <button
              type="button"
              className="clear-btn"
              onClick={handleClearAll}
            >
              Clear all
            </button>
          )}
          {availableCategories.length === 0 && (
            <p className="no-categories">No categories available</p>
          )}
          {availableCategories.map((cat) => (
            <label key={cat} className="category-option">
              <input
                type="checkbox"
                checked={filters.categories.includes(cat)}
                onChange={() => handleToggle(cat)}
              />
              <span>{cat}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default CategoryFilter;
