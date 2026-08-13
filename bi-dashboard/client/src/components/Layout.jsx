import { NavLink, Outlet } from 'react-router-dom';
import DateRangePicker from './DateRangePicker';
import CategoryFilter from './CategoryFilter';

const navItems = [
  { to: '/', label: 'Sales Overview', icon: '📊' },
  { to: '/products', label: 'Product Performance', icon: '📦' },
  { to: '/customers', label: 'Customer Insights', icon: '👥' },
  { to: '/upload', label: 'Data Upload', icon: '📤' },
];

function Layout() {
  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>BI Dashboard</h2>
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
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main-area">
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
