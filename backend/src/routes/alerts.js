const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

// Get all alerts (with optional filtering)
router.get('/', alertController.list);

// Mark alert as read
router.patch('/:id', alertController.markRead);

// Mark all alerts as read
router.post('/mark-all-read', alertController.markAllRead);

module.exports = router;
