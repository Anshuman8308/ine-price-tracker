/**
 * Scheduler Service — finds due products and orchestrates batch scraping
 */
const trackedProductRepository = require('../../repositories/trackedProductRepository');
const priceHistoryRepository = require('../../repositories/priceHistoryRepository');
const scrapeLogRepository = require('../../repositories/scrapeLogRepository');
const pageSnapshotRepository = require('../../repositories/pageSnapshotRepository');
const alertService = require('../alerts/alertService');
const scraperService = require('../scraper/scraperService');
const config = require('../../config');

const schedulerService = {
  /**
   * Run scheduled scraping — called by external cron
   */
  async runScheduledScrapes() {
    console.log('[SCHEDULER] Starting scheduled scrape run...');
    const startTime = Date.now();

    // Find products due for scraping (with lock)
    const dueProducts = await trackedProductRepository.findDueProducts(config.scraperConcurrency * 3);

    if (dueProducts.length === 0) {
      console.log('[SCHEDULER] No products due for scraping');
      return { processed: 0, succeeded: 0, failed: 0, skipped: 0, duration: 0 };
    }

    console.log(`[SCHEDULER] Found ${dueProducts.length} products due for scraping`);

    let succeeded = 0;
    let failed = 0;

    // Process in batches with controlled concurrency
    const batches = [];
    for (let i = 0; i < dueProducts.length; i += config.scraperConcurrency) {
      batches.push(dueProducts.slice(i, i + config.scraperConcurrency));
    }

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(tp => this._scrapeTrackedProduct(tp))
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          succeeded++;
        } else {
          failed++;
        }
      }
    }

    // Close browser after batch
    await scraperService.closeBrowser();

    const duration = Date.now() - startTime;
    console.log(`[SCHEDULER] Run complete: ${succeeded} succeeded, ${failed} failed, ${duration}ms`);

    return {
      processed: dueProducts.length,
      succeeded,
      failed,
      skipped: 0,
      duration,
    };
  },

  /**
   * Scrape a single tracked product (used by both scheduler and manual scrape)
   */
  async scrapeTrackedProduct(trackedProductId) {
    const tracked = await trackedProductRepository.getById(trackedProductId);
    if (!tracked) {
      throw new Error(`Tracked product ${trackedProductId} not found`);
    }
    return this._scrapeTrackedProduct(tracked);
  },

  /**
   * Internal: scrape a tracked product
   */
  async _scrapeTrackedProduct(tracked) {
    const trackedProductId = tracked.id;
    const productUrl = tracked.url;

    console.log(`[SCHEDULER] Processing product ${trackedProductId}: ${tracked.name}`);

    try {
      // Get previous price data for alert comparison
      const previousPrice = await priceHistoryRepository.getLatest(trackedProductId);

      // Run scraper
      const scrapeResult = await scraperService.scrapeProduct(productUrl, trackedProductId);

      // Save all scrape logs (success, retried, failed — all attempts)
      for (const log of scrapeResult.logs) {
        await scrapeLogRepository.create(log);
      }

      if (scrapeResult.success && scrapeResult.data) {
        // Save successful price observation
        await priceHistoryRepository.create(
          trackedProductId,
          scrapeResult.data.price,
          scrapeResult.data.stockStatus
        );

        // Update tracked product timestamps
        await trackedProductRepository.updateAfterScrape(
          trackedProductId,
          tracked.scrape_frequency_minutes
        );

        // Check for alerts
        await alertService.checkAndCreateAlerts(
          trackedProductId,
          scrapeResult.data,
          previousPrice
        );

        // Structure change detection
        if (scrapeResult.structureHash) {
          const previousSnapshot = await pageSnapshotRepository.getLatest(tracked.product_id);

          if (previousSnapshot && previousSnapshot.structure_hash !== scrapeResult.structureHash) {
            // Structure changed!
            console.log(`[SCHEDULER] Structure change detected for product ${trackedProductId}`);
            
            await pageSnapshotRepository.create({
              product_id: tracked.product_id,
              structure_hash: scrapeResult.structureHash,
              detected_change: true,
              changed_fields: 'DOM structure modified',
              details: {
                previousHash: previousSnapshot.structure_hash,
                newHash: scrapeResult.structureHash,
              },
            });

            await alertService.createStructureChangeAlert(trackedProductId, {
              oldHash: previousSnapshot.structure_hash,
              newHash: scrapeResult.structureHash,
            });
          } else if (!previousSnapshot) {
            // First snapshot
            await pageSnapshotRepository.create({
              product_id: tracked.product_id,
              structure_hash: scrapeResult.structureHash,
              detected_change: false,
            });
          }
        }

        return { success: true, trackedProductId };
      } else {
        // Scrape failed — update timestamps but don't save bad data
        await trackedProductRepository.updateAfterScrape(
          trackedProductId,
          tracked.scrape_frequency_minutes
        );

        return { success: false, trackedProductId, error: scrapeResult.error };
      }
    } catch (error) {
      console.error(`[SCHEDULER] Error processing product ${trackedProductId}:`, error.message);

      // Release lock on error
      await trackedProductRepository.releaseLock(trackedProductId);

      return { success: false, trackedProductId, error: error.message };
    }
  },
};

module.exports = schedulerService;
