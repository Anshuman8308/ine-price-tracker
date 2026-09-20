# System Architecture & Design

## Overview
The INE Product Price Tracker is a full-stack web application designed to track prices and stock availability on a mock Single Page Application (SPA) e-commerce storefront.

## The Challenge
The mock store (`https://demo.inelabteamdev.com/`) employs several anti-scraping techniques:
1. **Client-Side Rendering**: The server returns an empty HTML document. Content is fetched and rendered by React.
2. **Hidden Prices**: The listing pages do not contain prices. Prices are only available on the product detail page.
3. **Interactive Reveal**: Prices are hidden behind a "Reveal Price" button.
4. **Synthetic Event Bot Protection**: The button remains disabled unless a specific human-like mouse interaction pattern is detected over the `.price-block` container.

## Bot Bypass Implementation
Standard headless browser interactions (e.g., `element.hover()` or `element.click()`) trigger instantaneous events that fail the store's `minMoves` constraint.

Our `scraperService.js` defeats this by:
1. Locating the bounding box of the price container.
2. Firing an initial `mouse.move` event to trigger `onMouseEnter`.
3. Executing a loop of 20 incremental `mouse.move` coordinates, interspaced with `60ms` delays.
4. Simulating a human reading delay (`1500ms` dwell time) before clicking the button.
5. Extracting the revealed price via robust Regex parsing (handling currency symbols, commas, etc.).

## Architecture
The system consists of three main tiers:
1. **Frontend (Vite/React)**: A responsive dashboard utilizing Tailwind CSS. It communicates with the backend via a REST API.
2. **Backend (Express)**: Exposes APIs for product management, dashboard metrics, and alerts.
3. **PostgreSQL Database**: A relational schema ensuring referential integrity between products, trackings, historical price logs, and scrape attempt metadata.

## Database Schema Highlights
- `products`: Caches the scraped catalog.
- `tracked_products`: Stores user intent, active status, and `next_scrape_at` timestamps based on a configurable `scrape_frequency_minutes`.
- `price_history`: Only stores valid, successful data points.
- `scrape_logs`: Maintains an immutable audit trail of every attempt (Success, Retried, Failed), including response times and error types.
- `page_snapshots`: Stores SHA-256 hashes of the DOM structure (excluding dynamic prices) to detect unexpected changes to the store layout.

## Scheduler & Concurrency
To ensure the scraper doesn't overwhelm the backend or the target store, a cron endpoint (`POST /api/scheduler/run`) is exposed. 
When triggered, it uses PostgreSQL's `SELECT ... FOR UPDATE SKIP LOCKED` (implemented via logical locking in Node) to safely grab a batch of due products and scrape them concurrently (controlled by `config.scraperConcurrency`).
