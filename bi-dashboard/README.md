# Business Intelligence Dashboard

A web-based BI dashboard for small-to-medium retail/F&B businesses. Transforms raw transaction data into actionable insights — sales trends, product performance, customer behavior, and auto-generated business recommendations.

Built as a portfolio project for a Business Information Systems diploma.

## Architecture

```
bi-dashboard/
├── client/          # React frontend (Vite + Recharts)
│   └── src/
├── server/          # Node.js/Express backend
│   └── src/
│       ├── routes/      # API route handlers
│       ├── services/    # Business logic (analytics, recommendations)
│       └── models/      # Database access layer
└── README.md
```

### Tech Stack

| Layer    | Technology                     |
|----------|--------------------------------|
| Frontend | React 18, Recharts, Vite       |
| Backend  | Node.js, Express               |
| Database | SQLite (via better-sqlite3)    |
| Hosting  | AWS Free Tier compatible       |

### Design Decisions

- **SQLite** chosen over PostgreSQL for zero-config local development and easy portability. Sufficient for the 10K–50K row target dataset. Can be swapped to PostgreSQL for production via a thin data access layer.
- **Recharts** chosen for React-native chart components with good defaults and minimal configuration.
- **Vite** for fast dev server and optimized production builds.
- **Monorepo structure** (`client/` + `server/`) keeps frontend and backend cleanly separated while living in one project directory.

## Prerequisites

- Node.js >= 18.x
- npm >= 9.x

## Setup

```bash
# Install server dependencies
cd server
npm install

# Seed the database with sample data
npm run seed

# Start the backend (default: http://localhost:3001)
npm run dev
```

```bash
# In a separate terminal — install client dependencies
cd client
npm install

# Start the frontend (default: http://localhost:5173)
npm run dev
```

## Deployment (AWS Free Tier)

- **Backend**: EC2 t2.micro or Lambda + API Gateway
- **Frontend**: S3 static hosting + CloudFront
- **Database**: SQLite file on EC2 (or RDS Free Tier PostgreSQL if scaling needed)

## Features

- CSV upload with validation and summary reporting
- Seed data generator (5,000+ realistic transactions)
- Sales overview with KPI cards and period-over-period comparison
- Revenue trend chart (daily/weekly/monthly toggle)
- Top products and category breakdown charts
- Product performance table with slow-moving product flagging
- Customer insights: repeat rate, top spenders, Active/At-Risk segmentation
- Auto-generated plain-English business recommendations
- Global date range and category filters

## License

MIT
