import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FilterProvider } from './context/FilterContext';
import Layout from './components/Layout';
import SalesOverview from './pages/SalesOverview';
import ProductPerformance from './pages/ProductPerformance';
import CustomerInsights from './pages/CustomerInsights';
import DataUpload from './pages/DataUpload';

function App() {
  return (
    <BrowserRouter>
      <FilterProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<SalesOverview />} />
            <Route path="/products" element={<ProductPerformance />} />
            <Route path="/customers" element={<CustomerInsights />} />
            <Route path="/upload" element={<DataUpload />} />
          </Route>
        </Routes>
      </FilterProvider>
    </BrowserRouter>
  );
}

export default App;
