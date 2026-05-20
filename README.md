# SPS Group of Foundation — MFI Management System

Enterprise-grade Group Loan / Microfinance Management Software.

## Quick Start

Double-click `start.bat` — it launches both servers and opens the browser.

Or manually:

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run seed      # First time only — creates DB + sample data
npm run dev       # Starts on http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev       # Starts on http://localhost:5173
```

## Login Credentials

| Role  | Email                  | Password  |
|-------|------------------------|-----------|
| Admin | admin@spsgroup.com     | admin123  |
| Staff | ravi@spsgroup.com      | staff123  |
| Staff | priya@spsgroup.com     | staff123  |

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 18 + Vite + TypeScript        |
| Styling  | Tailwind CSS v3 (Navy + Gold theme) |
| State    | Zustand + TanStack Query            |
| Charts   | Recharts                            |
| Backend  | Node.js + Express + TypeScript      |
| Database | SQLite (better-sqlite3)             |
| Auth     | JWT (7-day tokens)                  |

## Features

### Admin
- Dashboard with live stats, charts, agent performance
- Full center & group management
- Customer management (photo, Aadhaar, nominee, guarantor)
- Loan creation with EMI auto-calculation (flat/reducing)
- Loan approval workflow
- Collection tracking + bulk group collection
- Staff management + performance tracking
- Reports: Daily, Monthly, Pending Dues, Defaulters, Center-wise, Cash Book
- Expense management

### Staff / Field Agent
- Mobile-optimized collection screen
- Group collection mode (bulk payments in one tap)
- Pending dues with overdue tracking
- Receipt generation
- Collection history

### Loan Engine
- Flat rate & reducing balance calculations
- Daily / Weekly / Monthly EMI frequencies
- Auto-generates full repayment schedule
- Penalty per day for overdue
- Progress tracking

## Folder Structure

```
group loan/
├── backend/
│   ├── src/
│   │   ├── database.ts       # SQLite schema
│   │   ├── index.ts          # Express server
│   │   ├── middleware/auth.ts
│   │   ├── routes/           # All API routes
│   │   ├── utils/loanCalculator.ts
│   │   └── seed.ts
│   └── data/sps_mfi.db       # SQLite database (auto-created)
└── frontend/
    └── src/
        ├── pages/            # All page components
        ├── components/       # Layout, UI components
        ├── api/client.ts     # Axios API client
        ├── store/authStore.ts
        └── types/index.ts
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/dashboard/stats | Dashboard KPIs |
| GET/POST | /api/centers | Center management |
| GET/POST | /api/groups | Group management |
| GET/POST | /api/customers | Customer management |
| GET/POST | /api/loans | Loan management |
| GET | /api/loans/calculate | EMI calculator |
| PUT | /api/loans/:id/approve | Approve loan |
| GET/POST | /api/collections | Collections |
| POST | /api/collections/bulk | Bulk group collection |
| GET | /api/collections/pending | Pending dues |
| GET/POST | /api/staff | Staff management |
| GET | /api/reports/daily-collection | Daily report |
| GET | /api/reports/pending-dues | Pending dues report |
| GET | /api/reports/defaulters | Defaulters list |
| GET | /api/reports/cashbook | Cash book |
