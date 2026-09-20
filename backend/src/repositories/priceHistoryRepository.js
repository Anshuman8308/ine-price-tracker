/**
 * Price history repository
 */
const { query } = require('../config/database');

const priceHistoryRepository = {
  /**
   * Add a successful price observation
   */
  async create(trackedProductId, price, stockStatus) {
    const result = await query(
      `INSERT INTO price_history (tracked_product_id, price, stock_status, scraped_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [trackedProductId, price, stockStatus]
    );
    return result.rows[0];
  },

  /**
   * Get price history for a tracked product
   */
  async getByTrackedProduct(trackedProductId, limit = 100) {
    const result = await query(
      `SELECT * FROM price_history 
       WHERE tracked_product_id = $1 
       ORDER BY scraped_at DESC 
       LIMIT $2`,
      [trackedProductId, limit]
    );
    return result.rows;
  },

  /**
   * Get the latest price observation
   */
  async getLatest(trackedProductId) {
    const result = await query(
      `SELECT * FROM price_history 
       WHERE tracked_product_id = $1 
       ORDER BY scraped_at DESC 
       LIMIT 1`,
      [trackedProductId]
    );
    return result.rows[0] || null;
  },

  /**
   * Get the previous price observation (second latest)
   */
  async getPrevious(trackedProductId) {
    const result = await query(
      `SELECT * FROM price_history 
       WHERE tracked_product_id = $1 
       ORDER BY scraped_at DESC 
       LIMIT 1 OFFSET 1`,
      [trackedProductId]
    );
    return result.rows[0] || null;
  },
};

module.exports = priceHistoryRepository;
