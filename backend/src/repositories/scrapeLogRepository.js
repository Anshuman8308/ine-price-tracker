/**
 * Scrape log repository — records every scrape attempt
 */
const { query } = require('../config/database');

const scrapeLogRepository = {
  /**
   * Create a scrape log entry
   */
  async create(log) {
    const result = await query(
      `INSERT INTO scrape_logs 
       (tracked_product_id, attempt_id, attempt_number, status, started_at, completed_at, 
        response_time_ms, error_type, error_message, extracted_price, extracted_stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        log.tracked_product_id,
        log.attempt_id,
        log.attempt_number,
        log.status,
        log.started_at,
        log.completed_at || new Date(),
        log.response_time_ms || null,
        log.error_type || null,
        log.error_message || null,
        log.extracted_price || null,
        log.extracted_stock || null,
      ]
    );
    return result.rows[0];
  },

  /**
   * Get logs for a tracked product
   */
  async getByTrackedProduct(trackedProductId, limit = 50) {
    const result = await query(
      `SELECT * FROM scrape_logs 
       WHERE tracked_product_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [trackedProductId, limit]
    );
    return result.rows;
  },

  /**
   * Get recent activity across all products
   */
  async getRecentActivity(limit = 50) {
    const result = await query(
      `SELECT sl.*, p.name as product_name, p.image_url
       FROM scrape_logs sl
       JOIN tracked_products tp ON tp.id = sl.tracked_product_id
       JOIN products p ON p.id = tp.product_id
       ORDER BY sl.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  },
};

module.exports = scrapeLogRepository;
