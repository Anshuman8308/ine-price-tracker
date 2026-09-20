/**
 * Main route aggregator
 */
const express = require('express');
const router = express.Router();

const healthRoutes = require('./health');
const productRoutes = require('./products');
const trackedProductRoutes = require('./trackedProducts');
const alertRoutes = require('./alerts');
const schedulerRoutes = require('./scheduler');
const activityRoutes = require('./activity');
const settingsRoutes = require('./settings');

// Health
router.use('/health', healthRoutes);

// Products (search, catalog)
router.use('/products', productRoutes);

// Tracked products (CRUD, scrape, history, logs)
router.use('/tracked-products', trackedProductRoutes);

// Alerts
router.use('/alerts', alertRoutes);

// Scheduler (cron endpoint)
router.use('/scheduler', schedulerRoutes);

// Activity feed
router.use('/activity', activityRoutes);

// Settings
router.use('/settings', settingsRoutes);

module.exports = router;
