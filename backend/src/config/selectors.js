/**
 * Centralized scraper selectors for the INE mock store.
 * 
 * The INE store (https://demo.inelabteamdev.com) is a React SPA.
 * All content is rendered client-side — Playwright is required.
 * 
 * IMPORTANT: These selectors are derived from actual DOM inspection.
 * If the store structure changes, update selectors here ONLY.
 */

const SELECTORS = {
  // === LISTING PAGE ===
  listing: {
    // Product grid/container
    productGrid: '.product-grid, [class*="product-list"], [class*="products"]',
    // Individual product card/tile
    productCard: '.product-card, .tile, [class*="product-item"]',
    // Product link inside card
    productLink: 'a[href*="/product/"]',
    // Product name in listing
    productName: '.product-name, .tile-title, h3, h2',
    // Category tag
    category: '.category, .product-category, [class*="category"]',
    // Brand name
    brand: '.brand-name, [class*="brand"]',
    // SKU
    sku: '.sku, [class*="sku"]',
    // Pagination
    nextButton: 'button:has-text("Next"), button:has-text("›")',
    prevButton: 'button:has-text("Prev"), button:has-text("‹")',
    pageInfo: '.page-info, [class*="pagination"]',
  },

  // === PRODUCT DETAIL PAGE ===
  detail: {
    // Product title (h1)
    title: 'h1',
    // Category
    category: '.category, .breadcrumb, [class*="category"]',
    // Brand and SKU line
    brandSkuLine: '.brand-sku, [class*="brand"]',
    // Description
    description: '.product-description, .description, p',
    // Product image
    image: '.product-image img, .product-media img, [class*="product"] img',
    // Price container (the interactive price box)
    priceBox: '.price-box, .price-container, [class*="price-box"], [class*="price-container"]',
    // Price hidden text
    priceHidden: ':text("Price hidden")',
    // Reveal price button
    revealPriceButton: 'button:has-text("REVEAL PRICE"), button:has-text("Reveal price"), button:has-text("reveal price")',
    // Revealed price value (after interaction)
    priceValue: '.price-value, .price, [class*="price-amount"], [class*="current-price"]',
    // Stock/availability
    stockStatus: '.stock-status, .availability, [class*="stock"], [class*="availability"]',
    // In stock indicator
    inStock: ':text("In stock"), :text("In Stock"), :text("in stock")',
    outOfStock: ':text("Out of stock"), :text("Out of Stock"), :text("out of stock")',
    // Back link
    backLink: 'a.back-link, a[href="/"]',
    // Specifications
    specsSection: '.specifications, [class*="specs"]',
    // Reviews
    reviewsSection: '.reviews, [class*="reviews"]',
  },

  // === COOKIE CONSENT ===
  cookie: {
    acceptButton: 'button:has-text("Accept"), button[aria-label*="Accept"], button[aria-label*="accept"]',
    consentBanner: '.cookie-banner, .consent-banner, [class*="cookie"], [class*="consent"]',
  },
};

module.exports = SELECTORS;
