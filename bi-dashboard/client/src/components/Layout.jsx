import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import DateRangePicker from './DateRangePicker';
import CategoryFilter from './CategoryFilter';

const navItems = [
  { to: '/', label: 'Sales Overview', icon: '📊' },
  { to: '/products', label: 'Product Performance', icon: '📦' },
  { to: '/customers', label: 'Customer Insights', icon: '👥' },
  { to: '/upload', label: 'Data Upload', icon: '📤' },
];

const STORAGE_KEY = 'bi-sidebar-collapsed';

function Layout() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore storage errors
    }
  }, [collapsed]);

  const toggleCollapsed = () => setCollapsed((prev) => !prev);

  return (
    <div className="dashboard-layout">
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-brand">
          <h2>{collapsed ? 'BI' : 'BI Dashboard'}</h2>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
              end={item.to === '/'}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          className="sidebar-collapse-btn"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </aside>
      <div className={`main-area${collapsed ? ' sidebar-collapsed' : ''}`}>
        <header className="filter-bar">
          <DateRangePicker />
          <CategoryFilter />
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
