/**
 * Tracked product repository — database operations for tracked products
 */
const { query, getClient } = require('../config/database');

const trackedProductRepository = {
  /**
   * List all tracked products with their latest price/stock
   */
  async list(filters = {}) {
    let whereClause = '1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.isActive !== undefined) {
      whereClause += ` AND tp.is_active = $${paramIndex++}`;
      params.push(filters.isActive);
    }

    const result = await query(
      `SELECT tp.*, 
        p.external_product_id, p.name, p.url, p.image_url, p.category, p.brand, p.sku, p.description,
        latest_price.price as current_price,
        latest_price.stock_status as stock_status,
        latest_price.scraped_at as last_successful_scrape_at,
        (tp.scrape_lock_until > NOW()) as is_scraping,
        prev_price.price as previous_price,
        latest_log.status as last_scrape_status,
        latest_log.error_message as last_scrape_error,
        (SELECT COUNT(*) FROM alerts a WHERE a.tracked_product_id = tp.id AND a.is_read = false) as unread_alerts
       FROM tracked_products tp
       JOIN products p ON p.id = tp.product_id
       LEFT JOIN LATERAL (
         SELECT price, stock_status, scraped_at 
         FROM price_history ph 
         WHERE ph.tracked_product_id = tp.id 
         ORDER BY ph.scraped_at DESC LIMIT 1
       ) latest_price ON true
       LEFT JOIN LATERAL (
         SELECT price
         FROM price_history ph2 
         WHERE ph2.tracked_product_id = tp.id 
         ORDER BY ph2.scraped_at DESC LIMIT 1 OFFSET 1
       ) prev_price ON true
       LEFT JOIN LATERAL (
         SELECT status, error_message
         FROM scrape_logs sl 
         WHERE sl.tracked_product_id = tp.id 
         ORDER BY sl.created_at DESC LIMIT 1
       ) latest_log ON true
       WHERE ${whereClause}
       ORDER BY tp.created_at DESC`,
      params
    );
    return result.rows;
  },

  /**
   * Get a tracked product by its ID
   */
  async getById(id) {
    const result = await query(
      `SELECT tp.*, 
        p.external_product_id, p.name, p.url, p.image_url, p.category, p.brand, p.sku, p.description,
        latest_price.price as current_price,
        latest_price.stock_status as stock_status,
        latest_price.scraped_at as last_successful_scrape_at,
        (tp.scrape_lock_until > NOW()) as is_scraping,
        prev_price.price as previous_price,
        latest_log.status as last_scrape_status,
        latest_log.error_message as last_scrape_error
       FROM tracked_products tp
       JOIN products p ON p.id = tp.product_id
       LEFT JOIN LATERAL (
         SELECT price, stock_status, scraped_at 
         FROM price_history ph 
         WHERE ph.tracked_product_id = tp.id 
         ORDER BY ph.scraped_at DESC LIMIT 1
       ) latest_price ON true
       LEFT JOIN LATERAL (
         SELECT price
         FROM price_history ph2 
         WHERE ph2.tracked_product_id = tp.id 
         ORDER BY ph2.scraped_at DESC LIMIT 1 OFFSET 1
       ) prev_price ON true
       LEFT JOIN LATERAL (
         SELECT status, error_message
         FROM scrape_logs sl 
         WHERE sl.tracked_product_id = tp.id 
         ORDER BY sl.created_at DESC LIMIT 1
       ) latest_log ON true
       WHERE tp.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Check if a product is already tracked
   */
  async getByProductId(productId) {
    const result = await query(
      'SELECT * FROM tracked_products WHERE product_id = $1',
      [productId]
    );
    return result.rows[0] || null;
  },

  /**
   * Track a new product
   */
  async create(productId, scrapeFrequencyMinutes = 120) {
    const nextScrapeAt = new Date();
    const result = await query(
      `INSERT INTO tracked_products (product_id, is_active, scrape_frequency_minutes, next_scrape_at)
       VALUES ($1, true, $2, $3)
       RETURNING *`,
      [productId, scrapeFrequencyMinutes, nextScrapeAt]
    );
    return result.rows[0];
  },

  /**
   * Update tracked product (pause/resume, frequency)
   */
  async update(id, updates) {
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (updates.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      params.push(updates.is_active);
    }

    if (updates.scrape_frequency_minutes !== undefined) {
      setClauses.push(`scrape_frequency_minutes = $${paramIndex++}`);
      params.push(updates.scrape_frequency_minutes);

      // Recalculate next_scrape_at based on last_scraped_at and new frequency
      setClauses.push(`next_scrape_at = COALESCE(last_scraped_at, NOW()) + ($${paramIndex++} || ' minutes')::interval`);
      params.push(updates.scrape_frequency_minutes);
    }

    if (updates.last_scraped_at !== undefined) {
      setClauses.push(`last_scraped_at = $${paramIndex++}`);
      params.push(updates.last_scraped_at);
    }

    if (updates.next_scrape_at !== undefined) {
      setClauses.push(`next_scrape_at = $${paramIndex++}`);
      params.push(updates.next_scrape_at);
    }

    if (updates.scrape_lock_until !== undefined) {
      setClauses.push(`scrape_lock_until = $${paramIndex++}`);
      params.push(updates.scrape_lock_until);
    }

    setClauses.push('updated_at = NOW()');
    params.push(id);

    const result = await query(
      `UPDATE tracked_products SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },

  /**
   * Delete tracked product (untrack)
   */
  async delete(id) {
    const result = await query(
      'DELETE FROM tracked_products WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Find products due for scraping (with lock to prevent duplicates)
   */
  async findDueProducts(limit = 10) {
    const result = await query(
      `UPDATE tracked_products 
       SET scrape_lock_until = NOW() + INTERVAL '5 minutes'
       WHERE id IN (
         SELECT tp.id 
         FROM tracked_products tp
         WHERE tp.is_active = true 
           AND tp.next_scrape_at <= NOW()
           AND (tp.scrape_lock_until IS NULL OR tp.scrape_lock_until < NOW())
         ORDER BY tp.next_scrape_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [limit]
    );
    return result.rows;
  },

  /**
   * Release scrape lock after completion
   */
  async releaseLock(id) {
    await query(
      'UPDATE tracked_products SET scrape_lock_until = NULL WHERE id = $1',
      [id]
    );
  },

  /**
   * Update scrape timestamps after a scrape
   */
  async updateAfterScrape(id, scrapeFrequencyMinutes) {
    const now = new Date();
    const nextScrapeAt = new Date(now.getTime() + scrapeFrequencyMinutes * 60000);
    
    await query(
      `UPDATE tracked_products 
       SET last_scraped_at = $1, 
           next_scrape_at = $2, 
           scrape_lock_until = NULL,
           updated_at = NOW()
       WHERE id = $3`,
      [now, nextScrapeAt, id]
    );
  },

  /**
   * Get stats for dashboard
   */
  async getStats() {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE tp.is_active = true) as active,
        COUNT(*) FILTER (WHERE tp.is_active = false) as paused,
        COUNT(*) FILTER (WHERE latest_price.stock_status = 'IN_STOCK') as in_stock,
        COUNT(*) FILTER (WHERE latest_price.stock_status = 'OUT_OF_STOCK') as out_of_stock,
        (SELECT COUNT(*) FROM alerts WHERE is_read = false) as active_alerts
      FROM tracked_products tp
      LEFT JOIN LATERAL (
        SELECT stock_status
        FROM price_history ph 
        WHERE ph.tracked_product_id = tp.id 
        ORDER BY ph.scraped_at DESC LIMIT 1
      ) latest_price ON true
    `);
    return result.rows[0];
  },
};

module.exports = trackedProductRepository;
