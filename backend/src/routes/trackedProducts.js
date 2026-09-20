const express = require('express');
const router = express.Router();
const trackedProductController = require('../controllers/trackedProductController');

// List all tracked products
router.get('/', trackedProductController.list);

// Track a new product
router.post('/', trackedProductController.track);

// Get tracked product details
router.get('/:id', trackedProductController.getById);

// Update tracked product (pause/resume, change frequency)
router.patch('/:id', trackedProductController.update);

// Untrack (delete)
router.delete('/:id', trackedProductController.untrack);

// Manual scrape
router.post('/:id/scrape', trackedProductController.scrapeNow);

// Price/stock history
router.get('/:id/history', trackedProductController.getHistory);

// Scrape logs
router.get('/:id/logs', trackedProductController.getLogs);

// Product-specific alerts
router.get('/:id/alerts', trackedProductController.getAlerts);

module.exports = router;
