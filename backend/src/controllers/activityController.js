/**
 * Activity Controller — recent scraper activity feed
 */
const scrapeLogRepository = require('../repositories/scrapeLogRepository');
const alertRepository = require('../repositories/alertRepository');

const activityController = {
  /**
   * GET /api/activity
   */
  async getRecent(req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);

      const recentLogs = await scrapeLogRepository.getRecentActivity(limit);
      const recentAlerts = await alertRepository.list({}, 20);

      // Merge into a unified activity feed
      const activities = [];

      for (const log of recentLogs) {
        let icon = '✓';
        let label = 'successful scrape';
        if (log.status === 'FAILED') {
          icon = '✕';
          label = 'failed';
          if (log.error_message) label += ` — ${log.error_message.substring(0, 80)}`;
        } else if (log.status === 'RETRIED') {
          icon = '↻';
          label = `retrying (attempt ${log.attempt_number})`;
        }

        activities.push({
          type: 'scrape',
          icon,
          status: log.status,
          label,
          product_name: log.product_name,
          image_url: log.image_url,
          timestamp: log.completed_at || log.created_at,
          details: {
            attempt_number: log.attempt_number,
            response_time_ms: log.response_time_ms,
            extracted_price: log.extracted_price,
            extracted_stock: log.extracted_stock,
            error_type: log.error_type,
          },
        });
      }

      for (const alert of recentAlerts) {
        let icon = '🔔';
        if (alert.alert_type === 'PRICE_DROP') icon = '↓';
        if (alert.alert_type === 'BACK_IN_STOCK') icon = '📦';
        if (alert.alert_type === 'STRUCTURE_CHANGE') icon = '⚠';

        activities.push({
          type: 'alert',
          icon,
          status: alert.alert_type,
          label: alert.message,
          product_name: alert.product_name,
          image_url: alert.image_url,
          timestamp: alert.triggered_at,
          details: {
            alert_type: alert.alert_type,
            old_value: alert.old_value,
            new_value: alert.new_value,
          },
        });
      }

      // Sort by timestamp descending
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      res.json({
        success: true,
        data: {
          activities: activities.slice(0, limit),
          count: activities.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = activityController;
