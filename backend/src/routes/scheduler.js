const express = require('express');
const router = express.Router();
const schedulerController = require('../controllers/schedulerController');
const { authenticateCron } = require('../middleware/auth');

// Cron trigger — protected by CRON_SECRET
router.post('/run', authenticateCron, schedulerController.run);

module.exports = router;
