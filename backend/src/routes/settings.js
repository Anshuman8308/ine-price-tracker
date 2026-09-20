const express = require('express');
const router = express.Router();
const dynamicSettings = require('../config/dynamicSettings');

// GET /api/settings
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: dynamicSettings.get(),
  });
});

// PATCH /api/settings
router.patch('/', (req, res) => {
  const newSettings = dynamicSettings.update(req.body);
  res.json({
    success: true,
    data: newSettings,
  });
});

module.exports = router;
