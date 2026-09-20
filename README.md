# INE Product Price Tracker

A full-stack product tracking and alerting system designed to scrape the INE mock storefront, bypassing its interactive bot-protection mechanisms.

## Features
- **Headless Bot Bypass**: Specifically designed Playwright interaction loops to satisfy the SPA's `moves.length < req.minMoves` protection.
- **Configurable Tracking**: Track multiple products with individual scrape frequencies.
- **Robust Scheduling**: Uses an external cron trigger to drive batched, concurrency-controlled PostgreSQL locking queues.
- **Premium Dashboard**: A React + Vite + Tailwind CSS v4 frontend.
- **Alerts System**: Price drop percentages, back-in-stock transitions, and DOM structure change detection.

## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS v4, Lucide React, Axios, Chart.js
- **Backend**: Node.js, Express, Playwright (Headless Chromium)
- **Database**: PostgreSQL (via raw `pg`, designed for Supabase)
- **CI/CD**: GitHub Actions

## Setup Instructions

### 1. Database Setup
1. Create a [Supabase](https://supabase.com/) project.
2. Execute the `backend/schema.sql` script in the Supabase SQL Editor.
3. Obtain the connection string (Session Pooler URI on port 6543).

### 2. Backend
```bash
cd backend
npm install

# Copy .env.example to .env and fill in DATABASE_URL
cp .env.example .env

# Run development server
npm run dev

# Run Headed Scraper Demo (for 2-4 minute video)
npm run scraper:headed

# Run Test Suite
npm test
```

### 3. Frontend
```bash
cd frontend
npm install

# Run development server
npm run dev
```

Visit `http://localhost:5173` to access the dashboard.

## Demo Video
Run `npm run scraper:headed` in the `backend` directory. This script explicitly demonstrates the exponential backoff retry mechanism by artificially lowering the timeout on the first attempt, and then successfully executing the slow-mouse-movement bypass on the final attempt.

## Deployment
- **Frontend**: Ready for Vercel (see `vercel.json`).
- **Backend**: Ready for Render (see `render.yaml`). Set `PLAYWRIGHT_BROWSERS_PATH` and build scripts as needed.
