/**
 * Page snapshot repository — structure change detection
 */
const { query } = require('../config/database');

const pageSnapshotRepository = {
  /**
   * Save a page snapshot
   */
  async create(snapshot) {
    const result = await query(
      `INSERT INTO page_snapshots 
       (product_id, structure_hash, detected_change, changed_fields, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        snapshot.product_id,
        snapshot.structure_hash,
        snapshot.detected_change || false,
        snapshot.changed_fields || null,
        snapshot.details ? JSON.stringify(snapshot.details) : null,
      ]
    );
    return result.rows[0];
  },

  /**
   * Get the latest snapshot for a product
   */
  async getLatest(productId) {
    const result = await query(
      `SELECT * FROM page_snapshots 
       WHERE product_id = $1 
       ORDER BY captured_at DESC 
       LIMIT 1`,
      [productId]
    );
    return result.rows[0] || null;
  },

  /**
   * Get snapshot history for a product
   */
  async getHistory(productId, limit = 20) {
    const result = await query(
      `SELECT * FROM page_snapshots 
       WHERE product_id = $1 
       ORDER BY captured_at DESC 
       LIMIT $2`,
      [productId, limit]
    );
    return result.rows;
  },
};

module.exports = pageSnapshotRepository;
