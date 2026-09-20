/**
 * Product repository — database operations for the product catalog
 */
const { query } = require('../config/database');

const productRepository = {
  /**
   * Search products by name (case-insensitive, partial match)
   */
  async search(searchQuery, limit = 20) {
    if (!searchQuery || searchQuery.trim() === '') {
      // Return some products when no query provided
      const result = await query(
        `SELECT p.*, 
          tp.id as tracked_product_id,
          tp.is_active as is_tracked
         FROM products p
         LEFT JOIN tracked_products tp ON tp.product_id = p.id
         ORDER BY p.name ASC
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    }

    const result = await query(
      `SELECT p.*, 
        tp.id as tracked_product_id,
        tp.is_active as is_tracked
       FROM products p
       LEFT JOIN tracked_products tp ON tp.product_id = p.id
       WHERE p.name ILIKE $1 OR p.sku ILIKE $1 OR p.category ILIKE $1 OR p.brand ILIKE $1
       ORDER BY 
         CASE WHEN p.name ILIKE $2 THEN 0 ELSE 1 END,
         p.name ASC
       LIMIT $3`,
      [`%${searchQuery}%`, `${searchQuery}%`, limit]
    );
    return result.rows;
  },

  /**
   * Get a product by internal ID
   */
  async getById(id) {
    const result = await query(
      `SELECT p.*, 
        tp.id as tracked_product_id,
        tp.is_active as is_tracked
       FROM products p
       LEFT JOIN tracked_products tp ON tp.product_id = p.id
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Get a product by external product ID (store product ID)
   */
  async getByExternalId(externalId) {
    const result = await query(
      'SELECT * FROM products WHERE external_product_id = $1',
      [externalId]
    );
    return result.rows[0] || null;
  },

  /**
   * Insert or update a product in the catalog
   */
  async upsert(product) {
    const result = await query(
      `INSERT INTO products (external_product_id, sku, name, url, image_url, category, brand, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (external_product_id) 
       DO UPDATE SET 
         name = EXCLUDED.name,
         url = EXCLUDED.url,
         image_url = COALESCE(EXCLUDED.image_url, products.image_url),
         category = COALESCE(EXCLUDED.category, products.category),
         brand = COALESCE(EXCLUDED.brand, products.brand),
         description = COALESCE(EXCLUDED.description, products.description),
         sku = COALESCE(EXCLUDED.sku, products.sku),
         updated_at = NOW()
       RETURNING *`,
      [
        product.external_product_id,
        product.sku || null,
        product.name,
        product.url,
        product.image_url || null,
        product.category || null,
        product.brand || null,
        product.description || null,
      ]
    );
    return result.rows[0];
  },

  /**
   * Bulk upsert products
   */
  async bulkUpsert(products) {
    const results = [];
    for (const product of products) {
      const result = await this.upsert(product);
      results.push(result);
    }
    return results;
  },

  /**
   * Get total product count
   */
  async count() {
    const result = await query('SELECT COUNT(*) as count FROM products');
    return parseInt(result.rows[0].count, 10);
  },
};

module.exports = productRepository;
