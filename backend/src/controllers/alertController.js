/**
 * Alert Controller
 */
const alertRepository = require('../repositories/alertRepository');

const alertController = {
  /**
   * GET /api/alerts
   */
  async list(req, res, next) {
    try {
      const filters = {};
      if (req.query.type) filters.alertType = req.query.type;
      if (req.query.unread === 'true') filters.isRead = false;

      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const alerts = await alertRepository.list(filters, limit);
      const unreadCount = await alertRepository.getUnreadCount();

      res.json({
        success: true,
        data: {
          alerts,
          count: alerts.length,
          unreadCount,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/alerts/:id
   */
  async markRead(req, res, next) {
    try {
      const { id } = req.params;
      const alert = await alertRepository.markRead(id);

      if (!alert) {
        return res.status(404).json({ success: false, error: { message: 'Alert not found' } });
      }

      res.json({ success: true, data: alert });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/alerts/mark-all-read
   */
  async markAllRead(req, res, next) {
    try {
      await alertRepository.markAllRead();
      res.json({ success: true, message: 'All alerts marked as read' });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = alertController;
