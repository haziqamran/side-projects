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

// TODO: Mount route modules
// app.use('/api/upload', require('./routes/upload'));
// app.use('/api/sales', require('./routes/sales'));
// app.use('/api/products', require('./routes/products'));
// app.use('/api/customers', require('./routes/customers'));
// app.use('/api/recommendations', require('./routes/recommendations'));

app.listen(PORT, () => {
  console.log(`BI Dashboard API running on http://localhost:${PORT}`);
});

module.exports = app;
