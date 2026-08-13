const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount route modules
const uploadRouter = require('./routes/upload');
app.use('/api', uploadRouter);

const salesRouter = require('./routes/sales');
app.use('/api/sales', salesRouter);

const productsRouter = require('./routes/products');
app.use('/api/products', productsRouter);

const customersRouter = require('./routes/customers');
app.use('/api/customers', customersRouter);

const recommendationsRouter = require('./routes/recommendations');
app.use('/api/recommendations', recommendationsRouter);

app.listen(PORT, () => {
  console.log(`BI Dashboard API running on http://localhost:${PORT}`);
});

module.exports = app;
