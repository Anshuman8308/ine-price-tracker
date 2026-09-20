/**
 * Product Controller — search and catalog operations
 */
const productRepository = require('../repositories/productRepository');
const scraperService = require('../services/scraper/scraperService');
const { AppError } = require('../middleware/errorHandler');

const productController = {
  /**
   * GET /api/products/search?q=<query>
   */
  async search(req, res, next) {
    try {
      const { q } = req.query;
      const limit = Math.min(parseInt(req.query.limit) || 20, 50);

      const products = await productRepository.search(q, limit);

      res.json({
        success: true,
        data: {
          products,
          query: q || '',
          count: products.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/products/:id
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const product = await productRepository.getById(id);

      if (!product) {
        throw new AppError('Product not found', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/products/refresh-catalog
   * Scrapes the INE store listing to build/update the product catalog
   */
  async refreshCatalog(req, res, next) {
    try {
      const maxPages = parseInt(req.query.pages) || 200; // Default: follow all pagination (safety cap 200)

      console.log(`[CATALOG] Starting catalog refresh (${maxPages} pages)...`);

      const products = await scraperService.scrapeCatalog(maxPages);

      // Upsert all products
      const results = await productRepository.bulkUpsert(products);

      // Close browser after catalog build
      await scraperService.closeBrowser();

      const totalCount = await productRepository.count();

      res.json({
        success: true,
        data: {
          scraped: products.length,
          saved: results.length,
          totalInDatabase: totalCount,
          pagesScraped: maxPages,
        },
      });
    } catch (error) {
      await scraperService.closeBrowser();
      next(error);
    }
  },
};

module.exports = productController;
