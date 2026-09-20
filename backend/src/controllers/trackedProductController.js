/**
 * Tracked Product Controller — CRUD, scraping, history, logs
 */
const trackedProductRepository = require('../repositories/trackedProductRepository');
const productRepository = require('../repositories/productRepository');
const priceHistoryRepository = require('../repositories/priceHistoryRepository');
const scrapeLogRepository = require('../repositories/scrapeLogRepository');
const alertRepository = require('../repositories/alertRepository');
const schedulerService = require('../services/scheduler/schedulerService');
const scraperService = require('../services/scraper/scraperService');
const { AppError } = require('../middleware/errorHandler');
const config = require('../config');

const trackedProductController = {
  /**
   * GET /api/tracked-products
   */
  async list(req, res, next) {
    try {
      const filters = {};
      if (req.query.active !== undefined) {
        filters.isActive = req.query.active === 'true';
      }

      const trackedProducts = await trackedProductRepository.list(filters);
      const stats = await trackedProductRepository.getStats();

      res.json({
        success: true,
        data: {
          trackedProducts,
          stats,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/tracked-products
   * Body: { productId, scrapeFrequencyMinutes? }
   */
  async track(req, res, next) {
    try {
      const { productId, scrapeFrequencyMinutes } = req.body;

      if (!productId) {
        throw new AppError('productId is required', 400, 'VALIDATION_ERROR');
      }

      // Verify product exists
      const product = await productRepository.getById(productId);
      if (!product) {
        throw new AppError('Product not found', 404, 'NOT_FOUND');
      }

      // Check for duplicate tracking
      const existing = await trackedProductRepository.getByProductId(productId);
      if (existing) {
        // If it was untracked, just re-activate it
        if (!existing.is_active) {
          const updated = await trackedProductRepository.update(existing.id, {
            is_active: true,
            scrape_frequency_minutes: scrapeFrequencyMinutes || config.defaultScrapeFrequencyMinutes,
          });
          const fullData = await trackedProductRepository.getById(updated.id);
          return res.json({
            success: true,
            data: fullData,
            message: 'Product tracking re-activated',
          });
        }
        throw new AppError('Product is already being tracked', 409, 'DUPLICATE');
      }

      const trackedProduct = await trackedProductRepository.create(
        productId,
        scrapeFrequencyMinutes || config.defaultScrapeFrequencyMinutes
      );

      const fullData = await trackedProductRepository.getById(trackedProduct.id);

      res.status(201).json({
        success: true,
        data: fullData,
        message: 'Product is now being tracked',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/tracked-products/:id
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const tracked = await trackedProductRepository.getById(id);

      if (!tracked) {
        throw new AppError('Tracked product not found', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        data: tracked,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/tracked-products/:id
   * Body: { is_active?, scrape_frequency_minutes? }
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { is_active, scrape_frequency_minutes } = req.body;

      const tracked = await trackedProductRepository.getById(id);
      if (!tracked) {
        throw new AppError('Tracked product not found', 404, 'NOT_FOUND');
      }

      const updates = {};
      if (is_active !== undefined) updates.is_active = is_active;
      if (scrape_frequency_minutes !== undefined) {
        const validFreqs = [30, 60, 120, 240, 360, 720, 1440];
        if (!validFreqs.includes(scrape_frequency_minutes)) {
          throw new AppError(
            `Invalid frequency. Must be one of: ${validFreqs.join(', ')} minutes`,
            400,
            'VALIDATION_ERROR'
          );
        }
        updates.scrape_frequency_minutes = scrape_frequency_minutes;
      }

      const updated = await trackedProductRepository.update(id, updates);
      const fullData = await trackedProductRepository.getById(updated.id);

      res.json({
        success: true,
        data: fullData,
        message: 'Tracking settings updated',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/tracked-products/:id
   */
  async untrack(req, res, next) {
    try {
      const { id } = req.params;
      const deleted = await trackedProductRepository.delete(id);

      if (!deleted) {
        throw new AppError('Tracked product not found', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        message: 'Product untracked. Historical data has been preserved in the database.',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/tracked-products/:id/scrape
   * Manual scrape trigger
   */
  async scrapeNow(req, res, next) {
    try {
      const { id } = req.params;
      const tracked = await trackedProductRepository.getById(id);

      if (!tracked) {
        throw new AppError('Tracked product not found', 404, 'NOT_FOUND');
      }

      if (tracked.is_scraping) {
        throw new AppError('A scrape is already in progress', 409, 'CONFLICT');
      }

      console.log(`[MANUAL SCRAPE] Triggered for product ${id}: ${tracked.name}`);

      // Manually acquire a lock for this specific product to indicate it's scraping
      await trackedProductRepository.update(id, {
        scrape_lock_until: new Date(Date.now() + 5 * 60000) // 5 minutes lock
      });

      // Fire and forget the scrape
      schedulerService.scrapeTrackedProduct(parseInt(id)).then(() => {
        // Scraper handles releasing the lock inside schedulerService
        console.log(`[MANUAL SCRAPE] Finished background scrape for ${id}`);
      }).catch(async (error) => {
        console.error(`[MANUAL SCRAPE] Error during background scrape for ${id}:`, error);
        await trackedProductRepository.releaseLock(parseInt(id));
      });

      // Fetch updated data (now shows is_scraping = true)
      const updatedTracked = await trackedProductRepository.getById(id);
      const latestPrice = await priceHistoryRepository.getLatest(id);
      const latestLogs = await scrapeLogRepository.getByTrackedProduct(id, 5);

      res.json({
        success: true,
        message: 'Scrape started',
        data: {
          trackedProduct: updatedTracked,
          latestPrice,
          recentLogs: latestLogs,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/tracked-products/:id/history
   */
  async getHistory(req, res, next) {
    try {
      const { id } = req.params;
      const limit = Math.min(parseInt(req.query.limit) || 100, 500);

      const tracked = await trackedProductRepository.getById(id);
      if (!tracked) {
        throw new AppError('Tracked product not found', 404, 'NOT_FOUND');
      }

      const history = await priceHistoryRepository.getByTrackedProduct(id, limit);

      res.json({
        success: true,
        data: {
          trackedProduct: tracked,
          history,
          count: history.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/tracked-products/:id/logs
   */
  async getLogs(req, res, next) {
    try {
      const { id } = req.params;
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);

      const tracked = await trackedProductRepository.getById(id);
      if (!tracked) {
        throw new AppError('Tracked product not found', 404, 'NOT_FOUND');
      }

      const logs = await scrapeLogRepository.getByTrackedProduct(id, limit);

      res.json({
        success: true,
        data: {
          trackedProduct: tracked,
          logs,
          count: logs.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/tracked-products/:id/alerts
   */
  async getAlerts(req, res, next) {
    try {
      const { id } = req.params;
      const alerts = await alertRepository.list({ trackedProductId: parseInt(id) });

      res.json({
        success: true,
        data: { alerts, count: alerts.length },
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = trackedProductController;
