# Business Intelligence Dashboard

A web-based BI dashboard for small-to-medium retail and F&B business owners. Transforms raw transaction data into actionable insights — sales trends, product performance, customer behavior, and auto-generated plain-English business recommendations.

Built as a portfolio project for a Business Information Systems diploma.

---

## Prerequisites

| Tool    | Version  |
|---------|----------|
| Node.js | >= 18.x  |
| npm     | >= 9.x   |

No external database software required — SQLite is bundled via `better-sqlite3`.

---

## Installation & Setup

### Backend (Express API)

```bash
cd server
npm install

# Seed the database with ~5,500 sample transactions (optional, recommended for first run)
npm run seed

# Start the backend server (default: http://localhost:3001)
npm run dev
```

### Frontend (React SPA)

```bash
# In a separate terminal
cd client
npm install

# Start the dev server (default: http://localhost:5173)
npm run dev
```

The frontend proxies API requests to `localhost:3001` via Vite's dev server config.

---

## Architecture

```
bi-dashboard/
├── client/              # React frontend (Vite + Recharts)
│   └── src/
│       ├── components/  # Reusable UI: DateRangePicker, CategoryFilter, MetricCard, etc.
│       ├── pages/       # SalesOverview, ProductPerformance, CustomerInsights, DataUpload
│       ├── context/     # FilterContext (global date range + category state)
│       ├── hooks/       # useApi (shared fetch with loading state)
│       └── services/    # api.js (Axios instance + endpoint helpers)
├── server/              # Node.js/Express backend
│   └── src/
│       ├── routes/      # API route handlers (upload, sales, products, customers, recommendations)
│       ├── services/    # Business logic (analytics, recommendations, upload processing)
│       └── models/      # queries.js — reusable parameterized SQL query builders
└── README.md
```

### Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **SQLite** (via better-sqlite3) | Zero-ops database with no external server. Fast analytical queries on 10K–50K rows with WAL mode. Ideal for single-user dashboards. Can migrate to PostgreSQL if scaling is needed. |
| **Recharts** | Declarative React charting library with sensible defaults. Already fits the React ecosystem — no extra rendering layer. |
| **Monorepo** (`client/` + `server/`) | Keeps frontend and backend cleanly separated (no shared source files) while co-locating the full project in one repository for simpler version control and deployment. |
| **Server-side SQL aggregation** | All heavy computation (GROUP BY, period comparisons, threshold calculations) runs in SQLite, returning small JSON payloads. Keeps the frontend thin and the browser fast. |
| **Stateless REST API** | Simple, cacheable HTTP endpoints. No session state. Easy to deploy behind a reverse proxy or load balancer. |
| **React Context for filters** | Global date range + category state applies across all pages. Context avoids prop-drilling without pulling in Redux/Zustand for a single-user app. |

---

## Features

- **CSV Upload** — Drag-and-drop CSV upload with column validation, row-level data quality checks, and import summary reporting
- **Seed Data Generator** — One-click generation of 5,000+ realistic transactions across 6+ months, 5+ categories, and 50+ customers
- **Sales Overview** — KPI cards (revenue, orders, AOV) with period-over-period percentage change and trend badges
- **Revenue Trend Chart** — Interactive line chart with daily/weekly/monthly granularity toggle
- **Top Products & Category Breakdown** — Bar chart (top 5 by revenue) and donut chart (category %)
- **Product Performance Table** — Sortable table with trend indicators (up/down/stable) and slow-moving product flagging
- **Customer Insights** — Repeat vs one-time customer rate, top 10 spenders, Active/At-Risk segmentation
- **Business Recommendations** — Auto-generated plain-English insights (declining categories, zero-sale products, highest-growth category)
- **Global Filters** — Date range picker and multi-select category filter that apply across all pages

---

## API Endpoints

All data endpoints require `start` and `end` query parameters (YYYY-MM-DD). An optional `categories` parameter accepts comma-separated category names.

### Upload & Seed

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload and validate a CSV file (multipart, max 10 MB) |
| GET | `/api/upload/status` | Check if the database has any transaction data |
| POST | `/api/seed` | Generate ~5,500 sample transaction records |

### Sales

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sales/overview` | Total revenue, orders, AOV with period-over-period change |
| GET | `/api/sales/trend` | Time-series revenue data (accepts `granularity`: daily/weekly/monthly) |

### Products

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products/performance` | Full product table: revenue, units, trend, slow-mover flag |
| GET | `/api/products/top` | Top N products by revenue (accepts `limit`, default 5) |
| GET | `/api/products/categories` | Category revenue breakdown with percentages |

### Customers

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/customers/insights` | Repeat rate, top 10 customers, Active/At-Risk segments |

### Recommendations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/recommendations` | Plain-English business insights + `insufficientData` flag |

---

## Deployment (AWS Free Tier)

### Option A: Separate hosting

| Component | Service | Notes |
|-----------|---------|-------|
| Backend | EC2 t2.micro | Run Express + SQLite; PM2 for process management |
| Frontend | S3 + CloudFront | Static build (`npm run build` in `client/`); CDN-cached globally |
| Database | SQLite file on EC2 | Lives alongside the server process |

### Option B: Combined hosting

Run both frontend and backend on a single EC2 t2.micro:
1. Build the React app: `cd client && npm run build`
2. Serve the static build from Express using `express.static`
3. Use nginx as a reverse proxy (port 80 → Express on 3001)

### Deployment steps

1. Provision an EC2 t2.micro instance (Amazon Linux 2 / Ubuntu)
2. Install Node.js 18+ via nvm
3. Clone the repository and install dependencies
4. Run `npm run seed` (or upload real CSV data)
5. Start the server with PM2: `pm2 start server/src/index.js --name bi-dashboard`
6. For Option A: upload `client/dist/` to an S3 bucket and configure CloudFront
7. For Option B: configure nginx to proxy API requests and serve static files

---

## License

MIT
