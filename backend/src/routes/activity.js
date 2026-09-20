const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');

// Get recent activity
router.get('/', activityController.getRecent);

module.exports = router;
