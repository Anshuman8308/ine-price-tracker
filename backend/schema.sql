-- INE Product Price Tracker - Database Schema
-- Run this against your Supabase PostgreSQL database

-- ============================================
-- PRODUCTS: Master catalog from INE store
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  external_product_id VARCHAR(20) UNIQUE NOT NULL,
  sku VARCHAR(30),
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  image_url VARCHAR(500),
  category VARCHAR(100),
  brand VARCHAR(100),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRACKED_PRODUCTS: User's tracked products
-- ============================================
CREATE TABLE IF NOT EXISTS tracked_products (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  scrape_frequency_minutes INTEGER DEFAULT 120,
  last_scraped_at TIMESTAMPTZ,
  next_scrape_at TIMESTAMPTZ,
  scrape_lock_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id)
);

-- ============================================
-- PRICE_HISTORY: Successful observations only
-- ============================================
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  tracked_product_id INTEGER NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  stock_status VARCHAR(20) NOT NULL CHECK (stock_status IN ('IN_STOCK', 'OUT_OF_STOCK', 'UNKNOWN')),
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SCRAPE_LOGS: Every attempt (success/retry/fail)
-- ============================================
CREATE TABLE IF NOT EXISTS scrape_logs (
  id SERIAL PRIMARY KEY,
  tracked_product_id INTEGER NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL,
  attempt_number INTEGER DEFAULT 1,
  status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'RETRIED', 'FAILED')),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  response_time_ms INTEGER,
  error_type VARCHAR(100),
  error_message TEXT,
  extracted_price DECIMAL(10,2),
  extracted_stock VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAGE_SNAPSHOTS: Structure change detection
-- ============================================
CREATE TABLE IF NOT EXISTS page_snapshots (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  structure_hash VARCHAR(64) NOT NULL,
  detected_change BOOLEAN DEFAULT false,
  changed_fields TEXT,
  details JSONB,
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ALERTS: Price drop / back-in-stock / structure change
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  tracked_product_id INTEGER NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('PRICE_DROP', 'BACK_IN_STOCK', 'STRUCTURE_CHANGE', 'OUT_OF_STOCK')),
  old_value VARCHAR(100),
  new_value VARCHAR(100),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  delivery_status VARCHAR(20) DEFAULT 'IN_APP'
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_external_id ON products(external_product_id);

CREATE INDEX IF NOT EXISTS idx_tracked_products_next_scrape ON tracked_products(next_scrape_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tracked_products_product_id ON tracked_products(product_id);
CREATE INDEX IF NOT EXISTS idx_tracked_products_active ON tracked_products(is_active);

CREATE INDEX IF NOT EXISTS idx_price_history_tracked_product ON price_history(tracked_product_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrape_logs_tracked_product ON scrape_logs(tracked_product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_attempt_id ON scrape_logs(attempt_id);

CREATE INDEX IF NOT EXISTS idx_alerts_tracked_product ON alerts(tracked_product_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_page_snapshots_product ON page_snapshots(product_id, captured_at DESC);
