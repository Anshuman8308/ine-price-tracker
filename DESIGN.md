# Engineering Design Note: INE Product Price Tracker

## 1. Problem & Goals

The goal of this project is to provide an automated, highly reliable tracking system that monitors product pricing and stock availability exclusively on the INE mock store (`https://demo.inelabteamdev.com/`). 

The core engineering challenge lies in the target's anti-scraping defenses:
- A WebAssembly (WASM) Proof-of-Work challenge that delays page rendering.
- Prices that are hidden by default and require a dynamic "Reveal Price" interaction to decode.
- Layout obfuscation (e.g., zero-width characters in price strings).
- Cookie consent overlays that intercept synthetic clicks.

To meet the business requirement, the system must autonomously poll selected products on a 2-hour schedule, successfully navigating these defenses while maintaining a strict, honest audit trail of all execution attempts.

## 2. Architecture

The system utilizes a distributed, modular architecture to separate the frontend presentation, backend execution, and persistent storage layers.

```text
       [External Cron Trigger] 
            cron-job.org
                 | (Every 2 Hours)
                 v
+-----------------------------------+
|      Vercel (React Frontend)      |
|    - Dashboard UI                 |
|    - Alerts & Settings            |
+-----------------------------------+
                 |
                 v
+-----------------------------------+
|     Render (Node.js/Express API)  |
|    - Playwright Scraper Engine    |
|    - Task Scheduler               |
|    - Alert Generation             |
+-----------------------------------+
                 |
                 v
+-----------------------------------+
|    Supabase (PostgreSQL DB)       |
|    - Valid Price History          |
|    - Scrape Audit Logs            |
+-----------------------------------+
```

## 3. Scraping Design

### Playwright vs. Lightweight HTTP Scrapers
A lightweight scraper like Axios or Cheerio was immediately disqualified due to the target's client-side rendering and WASM challenge. Playwright is utilized because it provides a genuine browser execution context capable of executing the browser-side challenge flow and evaluating dynamic JavaScript.

### Dynamic Interaction and Extraction
- **WASM Challenge**: The scraper awaits the resolution of the WASM PoW loading spinner before proceeding.
- **Cookie Overlays**: Playwright actively checks for and dismisses generic cookie consent banners that typically block physical mouse interactions.
- **Price Reveal**: The scraper simulates human interaction to click the dynamic reveal button, awaits the DOM mutation, and parses the result.
- **Stock Status**: Scoped explicitly to the main product's metadata container to avoid erroneously parsing "In Stock" flags from related product carousels.

### Data Sanitization
Extracted strings are passed through a sanitation utility to aggressively strip currency symbols, commas, and zero-width characters (`\u200B`, `\u200C`, etc.) prior to database insertion.

### Retry Strategy
For transient network failures, unresolvable WASM loops, or browser crashes, the scraper implements a robust retry mechanism. It allows up to **3 attempts per product scrape** before officially marking the operation as a failure. 

## 4. Data Integrity & Failure Handling

A critical requirement of this assignment is honest historical logging. Treating a timeout or a WASM challenge failure as an "Out of Stock" or "$0.00" price observation corrupts historical data. 

To guarantee data integrity:
1. **Separation of Concerns**: The database uses two distinct tables: `price_history` and `scrape_logs`.
2. **Valid Observations**: Only scrapes that successfully extract both price and stock generate a new row in `price_history`.
3. **Honest Failure Logging**: If a scrape fails 3 consecutive times, it is logged in `scrape_logs` as `FAILED` with the exact stack trace. It **does not** overwrite the last valid price or stock state. 
4. **Visibility**: The dashboard provides users with raw access to these `scrape_logs`, offering total transparency into temporary blocks or timeouts.

## 5. Scheduling

The business requirement mandates checking tracked products every 2 hours.

- **External Cron**: Because the backend is deployed on a free-tier Render instance that aggressively spins down during idle periods, an internal Node.js `setInterval` is insufficient. 
- **Trigger**: The system relies on `cron-job.org` to issue an HTTP `POST /api/scheduler/run` request every 2 hours.
- **Authentication**: This endpoint is heavily secured using the `X-Cron-Secret` HTTP header to prevent unauthorized batch executions.
- **Manual "Scrape Now"**: Outside of the strict 2-hour schedule, users can manually trigger an immediate background scrape for any tracked product directly from the dashboard.

## 6. Data Model

The PostgreSQL schema enforces strict relational integrity:

- **`products`**: A cached catalog of all products discovered in the INE store.
- **`tracked_products`**: Stores products actively selected for monitoring, including their specific `scrape_frequency_minutes` and lock states.
- **`price_history`**: An append-only ledger of valid, successful price and stock observations used for historical graphing.
- **`scrape_logs`**: An immutable audit trail of every execution attempt (`SUCCESS`, `RETRIED`, `FAILED`), providing deep scraper diagnostics.
- **`page_snapshots`**: Records structural DOM hashes to identify backend layout changes.
- **`alerts`**: Stores generated transition events (e.g., `PRICE_DROP`, `OUT_OF_STOCK`).

## 7. Important Engineering Decisions / Trade-offs

- **Playwright Overhead**: Trading backend memory usage and execution time for the absolute necessity of bypassing client-side WASM challenges. 
- **Push vs. Pull Scheduling**: Trading internal architectural autonomy for guaranteed execution reliability by exposing an external cron webhook.
- **Event Sourcing for Prices**: Storing prices as an append-only time series (`price_history`) rather than simply updating a "current_price" column on the product table. This allows for rich historical graphing and transition analysis at the cost of slightly higher database storage.

## 8. Reliability / Edge Cases

The system explicitly handles the following edge cases:
- **Timeouts**: Playwright operations are wrapped in strict timeout boundaries.
- **Retry Exhaustion**: Halts after 3 attempts to prevent infinite anti-bot loops.
- **Obfuscation**: Aggressively strips zero-width characters before casting strings to decimals.
- **Original vs. Current Price**: Locators specifically target the current active price, explicitly rejecting `.price-original` nodes containing struck-through legacy prices.
- **Graceful Degradation**: If the store layout fundamentally changes, the scrape fails safely and logs a DOM structure error rather than inserting corrupt `$0.00` values.

## 9. AI-Assisted Development: From Prototype to Reliable Scraper

AI was used extensively during implementation, but the scraper required significant engineering iteration against the actual INE mock store. The initial generated approaches failed on the store's WASM challenge, dynamic price reveal, DOM obfuscation, misleading stock text, cookie overlays, and transient failures. The following examples document how those failures were investigated and corrected through browser inspection, targeted extraction logic, retry handling, and headed verification.

| Initial AI approach/problem | What failed in real testing | Engineering correction |
|---|---|---|
| Initial Axios/Cheerio scraper | Could not reliably obtain product data because the store uses client-side rendering and a WASM Proof-of-Work flow before the useful content becomes available. | Investigated the store's actual browser behavior and moved the scraper to Playwright, allowing the application to execute the same browser-side flow as a real user. |
| Generic price extraction | The scraper repeatedly selected the original/struck-through price instead of the actual discounted price. The current price was also obfuscated with zero-width characters. | Inspected the rendered DOM after the Reveal Price interaction and restricted extraction to the active price element, rejecting hidden/struck-through values and sanitizing zero-width characters. |
| Full-page stock extraction | A product could be reported `IN_STOCK` because the scraper found stock text belonging to a related-product section rather than the selected product. | Reverse-engineered the product-page structure and scoped stock extraction to the main product's stock badge/metadata container. Missing expected stock metadata now causes a scrape failure rather than `UNKNOWN`. |
| Direct Playwright click on Reveal Price | The Reveal Price interaction intermittently timed out because a cookie-consent overlay intercepted the physical mouse interaction. | Added overlay detection/dismissal and stabilized the interaction flow before attempting Reveal Price. Verified the behavior in headed browser runs. |
| Single-attempt scraping | Slow responses, browser failures and challenge timeouts could leave a product with no reliable observation. | Added up to 3 attempts per scrape, with every attempt recorded in `scrape_logs`. Exhausted retries produce an explicit `FAILED` result. |
| Treating scrape failures as observations | A failed/partial scrape could incorrectly overwrite the previously valid price or stock state. | Separated attempt logs from valid observations: only a fully successful price + stock extraction enters `price_history`; failures preserve the last known valid state. |
| Internal `setInterval` scheduler | Render's free-tier sleep behavior makes an in-process timer unreliable for the required 2-hour polling. | Replaced it with an authenticated scheduler endpoint triggered by cron-job.org every 2 hours. |

## 10. Testing

The backend business logic is strictly verified using the **Jest** testing framework.

- **Suite**: 3 distinct suites containing 14 automated test cases.
- **Coverage**: Validates accurate scheduler task batching, correct database transaction handling, and exact alert generation transitions (ensuring `OUT_OF_STOCK` properly suppresses redundant `PRICE_DROP` spam).
- **Headed Demo**: The repository includes a `npm run scraper:headed` command that executes a live, visible Playwright session. It intentionally simulates a timeout to physically demonstrate the system's retry mechanism and subsequent recovery to the reviewer.

## 11. Deployment

- **Frontend**: Vercel (Vite/React build).
- **Backend**: Render Web Service. Configured with `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium` to guarantee headless browser binaries are present in the Linux container.
- **Database**: Supabase PostgreSQL.
- **Scheduler**: cron-job.org webhooks.

## 12. Conclusion

- **Robust Execution**: Emulating a genuine browser ensures WASM and dynamic rendering challenges are consistently handled.
- **Data Sanctity**: A hard separation between attempt logs and valid price history guarantees the dashboard graphs represent absolute truth, never skewed by transient bot blocks.
- **Scalable Architecture**: The system cleanly decouples external cron triggers, independent scraper processes, and frontend presentation, resulting in a reliable monitoring architecture suitable for the assignment requirements.
