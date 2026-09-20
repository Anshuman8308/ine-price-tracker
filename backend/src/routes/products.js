const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Search products by name (partial/full, case-insensitive)
router.get('/search', productController.search);

// Get a single product by ID
router.get('/:id', productController.getById);

// Refresh product catalog from INE store
router.post('/refresh-catalog', productController.refreshCatalog);

module.exports = router;
