# INE Product Price Tracker

A full-stack, automated price and stock tracking system designed exclusively to monitor the INE mock store (`https://demo.inelabteamdev.com/`). This platform reliably extracts current pricing and stock availability, persists historical observations, handles anti-bot challenges gracefully, and provides a centralized dashboard for product management and alert notifications.

## Live Demo
- **Frontend**: [https://ine-price-tracker-frontend.vercel.app](https://ine-price-tracker-frontend.vercel.app) *(Update with actual Vercel link if available)*
- **Backend API**: [https://ine-price-tracker-api.onrender.com/api/health](https://ine-price-tracker-api.onrender.com/api/health) *(Update with actual Render link if available)*
- **GitHub Repository**: [https://github.com/Anshuman8308/ine-price-tracker](https://github.com/Anshuman8308/ine-price-tracker)

## Assignment Requirement Coverage

| Requirement | Implementation |
|-------------|----------------|
| **Product Search & Selection** | Search the INE catalog by name (`/api/products/search`), select products to track. |
| **Tracking Persistence** | Products are tracked in a PostgreSQL database (Supabase) via the `tracked_products` table. |
| **2-Hour Scraping** | An external `cron-job.org` trigger pings `POST /api/scheduler/run` every 2 hours to initiate a batch scrape. |
| **Price + Stock Extraction** | Playwright extracts dynamic price reveals (handling zero-width characters) and stock status. |
| **History Logging** | Only successful observations are stored in `price_history`. |
| **Detailed Scrape Logs** | Every attempt (Success, Retried, Failed) is logged in `scrape_logs` for honest traceability. |
| **Retry & Failure Handling** | Scraper enforces up to 3 retries with exponential backoff on timeouts/WASM challenges. Failures do NOT overwrite valid history. |
| **Headed Demo Run** | `npm run scraper:headed` demonstrates a live visual scrape with intentionally induced failures and recovery. |
| **External Scheduling** | Render free-tier instances sleep, so `cron-job.org` is used to reliably wake and trigger the scraper API. |
| **Alerts (Bonus)** | Generates `PRICE_DROP`, `BACK_IN_STOCK`, and `OUT_OF_STOCK` notifications. |
| **Configurable Frequency (Bonus)** | Database supports `scrape_frequency_minutes` per tracked product. |

## Features
- **Dynamic Search & Catalog**: Browse and search the mocked INE store.
- **Automated Monitoring**: Background scheduled scraping.
- **Dashboard Interface**: View tracked products, historical price trends, and current stock status.
- **Scrape Diagnostics**: Inspect the exact network/browser outcome of every single scrape attempt.
- **Intelligent Alerts**: Visual toast notifications and a dedicated alerts feed for price drops and stock transitions.
- **Resilient Execution**: Engineered to bypass the WASM PoW challenge and dynamic overlay interactions.

## Scraping Reliability
The INE mock store employs anti-bot measures, WASM-based Proof-of-Work challenges, delayed price reveals, and layout obfuscation (e.g., zero-width characters). A lightweight HTTP scraper (like Cheerio/Axios) cannot execute the necessary JavaScript to reveal the data.

To guarantee reliability, the system uses **Playwright**:
1. **Extraction**: Waits for the WASM challenge to solve, bypasses cookie consent overlays, and extracts the revealed dynamic price.
2. **Validation**: Extracted prices are sanitized (stripping zero-width characters and currency symbols) and validated against the original DOM price.
3. **Retries**: If a scrape times out or hits an unresolvable anti-bot loop, the system aborts, logs the failure, and retries up to 3 times with exponential backoff.
4. **Data Integrity**: If all 3 retries fail, the attempt is marked `FAILED` in the database. Crucially, **failed scrapes do not overwrite the last known valid price/stock**, ensuring historical data remains honest and accurate.

## Architecture

**User Flow:**
```text
User
 ↓
Vercel (React Frontend)
 ↓
Render (Express API)
 ↓
Supabase (PostgreSQL Database)
```

**Automated Scraping Flow:**
```text
cron-job.org (External Trigger)
 ↓
Render (POST /api/scheduler/run)
 ↓
Scheduler (Batches due products)
 ↓
Playwright Scraper
 ↓
INE mock store (Resolves WASM, Extracts DOM)
 ↓
Validation & Sanitization
 ↓
History, Logs, and Alerts Generation
 ↓
Supabase
```

## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, Recharts
- **Backend**: Node.js, Express.js
- **Scraping Engine**: Playwright
- **Database**: PostgreSQL (hosted on Supabase)
- **Task Scheduling**: cron-job.org
- **Deployment**: Vercel (Frontend), Render (Backend)
- **Testing**: Jest

## Data Model
- `products`: Caches the master catalog items available from the INE store.
- `tracked_products`: Maps users to the products they are actively tracking, managing lock states and scrape frequencies.
- `price_history`: Stores only *successful* price and stock observations for graphing.
- `scrape_logs`: Maintains an immutable audit trail of every execution attempt (`SUCCESS`, `RETRIED`, `FAILED`), including error messages.
- `page_snapshots`: Stores DOM structure hashes to detect backend layout changes.
- `alerts`: Records significant transitions (`PRICE_DROP`, `OUT_OF_STOCK`, `BACK_IN_STOCK`).

## API Overview
**Products & Tracking**
- `GET /api/products/search` - Search the mock catalog.
- `GET /api/tracked-products` - Retrieve all currently tracked items.
- `POST /api/tracked-products` - Begin tracking a new product.
- `POST /api/tracked-products/:id/scrape` - Manually trigger an immediate background scrape.

**Diagnostics & History**
- `GET /api/tracked-products/:id/history` - Retrieve valid price history.
- `GET /api/tracked-products/:id/logs` - Retrieve the raw scrape execution audit logs.

**Scheduling & Alerts**
- `POST /api/scheduler/run` - Triggered by cron-job.org to execute due scrapes (secured via `CRON_SECRET`).
- `GET /api/alerts` - Retrieve generated price/stock notifications.

## Environment Variables
Create a `.env` file in the `backend` directory based on `.env.example`:

```env
# Database - Supabase PostgreSQL
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres

# INE Store Target
INE_STORE_URL=https://demo.inelabteamdev.com

# Scraper Configuration
SCRAPER_TIMEOUT_MS=15000
SCRAPER_MAX_RETRIES=3
SCRAPER_CONCURRENCY=3

# Scheduler Auth
CRON_SECRET=your-secure-cron-secret-here

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## Local Setup

**1. Clone the repository**
```bash
git clone https://github.com/Anshuman8308/ine-price-tracker.git
cd ine-price-tracker
```

**2. Backend Setup**
```bash
cd backend
npm install
# Configure your .env file here
npm run db:setup
npm start
```

**3. Frontend Setup**
```bash
cd ../frontend
npm install
npm run dev
```

**4. Linting & Tests**
```bash
# In backend directory
npm run lint
npm test
```

## Headed Scraper Demo
To observe the Playwright scraper visually handling the mock store, run the following command from the `backend` directory:

```bash
npm run scraper:headed
```

**What this demonstrates:**
- Headed browser execution resolving the WASM challenge in real-time.
- An intentionally induced error/timeout on the first attempt to demonstrate the **Retry System**.
- Successful recovery and extraction on subsequent attempts.
- Honest logging output showing the exact lifecycle.

## Testing
The backend utilizes **Jest** for automated unit testing.
- **Test Framework**: Jest
- **Suites**: 3 test suites (`scraper.test.js`, `scheduler.test.js`, `alerts.test.js`)
- **Total Tests**: 14 test cases
- **Coverage**: Validates scraper logic, scheduler task batching, and strict alert transition states.

## Deployment
- **Frontend (Vercel)**: Standard Vite React deployment.
- **Backend (Render)**: Deployed as a web service. Because it requires a browser engine, the Render environment is configured to install Playwright dependencies (`npx playwright install --with-deps chromium`).
- **Database (Supabase)**: Serverless PostgreSQL.
- **Scheduler (cron-job.org)**: Pings `https://[YOUR_RENDER_URL]/api/scheduler/run` every 2 hours, utilizing the `Authorization: Bearer [CRON_SECRET]` header to wake the sleeping Render instance and trigger the batch scrape.

## Project Structure
```text
ine-price-tracker/
├── backend/
│   ├── scripts/          # DB setup and headed-scraper demo
│   ├── src/
│   │   ├── config/       # Environment & DB connection
│   │   ├── controllers/  # Route handlers
│   │   ├── middleware/   # Auth & rate limiting
│   │   ├── repositories/ # Database interaction layer
│   │   ├── routes/       # Express API routes
│   │   └── services/     # Core business logic (Scraper, Scheduler, Alerts)
│   ├── tests/            # Jest test suites
│   └── schema.sql        # PostgreSQL Schema
├── frontend/
│   ├── src/
│   │   ├── components/   # Reusable UI components & Layout
│   │   ├── contexts/     # Global state (ToastContext)
│   │   ├── pages/        # Dashboard, Catalog, Alerts
│   │   └── services/     # Axios API wrapper
└── README.md
```

## Engineering Notes / Trade-offs
- **Playwright vs Axios**: While Axios is significantly faster and uses less memory, it cannot execute the WASM PoW challenge required by the INE mock store. Playwright was absolutely necessary to emulate a human session.
- **Scheduler Push vs Pull**: A continuously running `setInterval` in Node.js would be killed when Render's free tier sleeps. Exposing a secured `/api/scheduler/run` endpoint allows an external, highly available cron service (cron-job.org) to wake the server and guarantee execution.
- **Storage Strategy**: Keeping `scrape_logs` separate from `price_history` guarantees that the price history graph remains clean and accurate, while still providing total transparency into temporary network failures or anti-bot blocks.

## Bonus Features
- **DOM Structure Detection**: The scraper creates a hash of critical DOM elements. If the store's HTML layout unexpectedly changes, the system logs a `STRUCTURE_CHANGE` event.
- **Configurable Frequencies**: The database schema (`scrape_frequency_minutes`) supports heterogeneous tracking schedules (e.g., tracking a volatile product every 1 hour, and a stable product every 24 hours).
- **Intelligent Alert Transitions**: Prevents notification spam by ensuring `OUT_OF_STOCK` and `PRICE_DROP` alerts evaluate context together, maintaining a clean user experience.
