/**
 * Alert repository — price drop, back-in-stock, structure change alerts
 */
const { query } = require('../config/database');

const alertRepository = {
  /**
   * Create an alert
   */
  async create(alert) {
    const result = await query(
      `INSERT INTO alerts 
       (tracked_product_id, alert_type, old_value, new_value, message, triggered_at, delivery_status)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       RETURNING *`,
      [
        alert.tracked_product_id,
        alert.alert_type,
        alert.old_value || null,
        alert.new_value || null,
        alert.message,
        alert.delivery_status || 'IN_APP',
      ]
    );
    return result.rows[0];
  },

  /**
   * List alerts with optional filtering
   */
  async list(filters = {}, limit = 50) {
    let whereClause = '1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.trackedProductId) {
      whereClause += ` AND a.tracked_product_id = $${paramIndex++}`;
      params.push(filters.trackedProductId);
    }

    if (filters.alertType) {
      whereClause += ` AND a.alert_type = $${paramIndex++}`;
      params.push(filters.alertType);
    }

    if (filters.isRead !== undefined) {
      whereClause += ` AND a.is_read = $${paramIndex++}`;
      params.push(filters.isRead);
    }

    params.push(limit);

    const result = await query(
      `SELECT a.*, p.name as product_name, p.image_url
       FROM alerts a
       JOIN tracked_products tp ON tp.id = a.tracked_product_id
       JOIN products p ON p.id = tp.product_id
       WHERE ${whereClause}
       ORDER BY a.triggered_at DESC
       LIMIT $${paramIndex}`,
      params
    );
    return result.rows;
  },

  /**
   * Mark an alert as read
   */
  async markRead(id) {
    const result = await query(
      'UPDATE alerts SET is_read = true WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Mark all alerts as read
   */
  async markAllRead() {
    await query('UPDATE alerts SET is_read = true WHERE is_read = false');
  },

  /**
   * Check for duplicate alert (prevent creating same alert for same scrape)
   */
  async checkDuplicate(trackedProductId, alertType, newValue) {
    const result = await query(
      `SELECT * FROM alerts 
       WHERE tracked_product_id = $1 
         AND alert_type = $2 
         AND new_value = $3
         AND triggered_at > NOW() - INTERVAL '5 minutes'
       LIMIT 1`,
      [trackedProductId, alertType, newValue]
    );
    return result.rows[0] || null;
  },

  /**
   * Get unread alert count
   */
  async getUnreadCount() {
    const result = await query(
      'SELECT COUNT(*) as count FROM alerts WHERE is_read = false'
    );
    return parseInt(result.rows[0].count, 10);
  },
};

module.exports = alertRepository;
