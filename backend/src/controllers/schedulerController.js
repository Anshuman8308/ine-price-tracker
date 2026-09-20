/**
 * Scheduler Controller — handles external cron trigger
 */
const schedulerService = require('../services/scheduler/schedulerService');

const schedulerController = {
  /**
   * POST /api/scheduler/run
   * Protected by CRON_SECRET (authenticated in middleware)
   */
  async run(req, res, next) {
    try {
      console.log('[SCHEDULER] Cron trigger received');

      const result = await schedulerService.runScheduledScrapes();

      res.json({
        success: true,
        data: result,
        message: `Scheduled scrape complete: ${result.succeeded}/${result.processed} succeeded in ${result.duration}ms`,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = schedulerController;
