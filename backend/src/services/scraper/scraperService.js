/**
 * Scraper Service — The core of the application.
 * 
 * Uses Playwright to scrape the INE mock store (React SPA).
 * Implements timeout protection, retry with exponential backoff,
 * data validation, and structure change detection.
 * 
 * Engineering decision: Playwright is required because the INE store
 * is a React SPA that renders content client-side. HTTP fetching returns
 * only an empty <div id="root">. Additionally, prices are hidden behind
 * a hover interaction that requires JavaScript execution.
 */
const { chromium } = require('playwright');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const config = require('../../config');
const SELECTORS = require('../../config/selectors');

class ScraperService {
  constructor() {
    this.browser = null;
    this.headed = process.env.HEADED === 'true';
  }

  /**
   * Launch browser instance
   */
  async launchBrowser() {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    console.log(`[SCRAPER] Launching browser (headed: ${this.headed})`);
    this.browser = await chromium.launch({
      headless: !this.headed,
      timeout: 30000,
      args: ['--force-device-scale-factor=1']
    });
    return this.browser;
  }

  /**
   * Close browser instance
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[SCRAPER] Browser closed');
    }
  }

  /**
   * Scrape a product's price and stock from the INE store.
   * Implements retry with exponential backoff.
   * 
   * @param {string} productUrl - The product detail page URL
   * @param {number} trackedProductId - The tracked product ID for logging
   * @returns {Object} { success, data, logs, structureHash }
   */
  async scrapeProduct(productUrl, trackedProductId) {
    const attemptId = uuidv4();
    const maxRetries = config.scraperMaxRetries;
    const logs = [];
    let lastError = null;
    let result = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startedAt = new Date();
      console.log(`[SCRAPER] Attempt ${attempt}/${maxRetries} for product ${trackedProductId}: ${productUrl}`);

      try {
        result = await this._attemptScrape(productUrl);

        const completedAt = new Date();
        const responseTimeMs = completedAt - startedAt;

        // Validate extracted data
        const validation = this._validateData(result);

        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // Log successful attempt
        logs.push({
          tracked_product_id: trackedProductId,
          attempt_id: attemptId,
          attempt_number: attempt,
          status: attempt > 1 ? 'RETRIED' : 'SUCCESS',
          started_at: startedAt,
          completed_at: completedAt,
          response_time_ms: responseTimeMs,
          extracted_price: result.price,
          extracted_stock: result.stockStatus,
        });

        // Mark previous failed attempts as RETRIED
        for (const log of logs) {
          if (log.status === 'FAILED' && log.attempt_number < attempt) {
            log.status = 'RETRIED';
          }
        }

        console.log(`[SCRAPER] SUCCESS: Price ₹${result.price}, Stock: ${result.stockStatus} (attempt ${attempt}, ${responseTimeMs}ms)`);

        return {
          success: true,
          data: result,
          logs,
          structureHash: result.structureHash,
        };

      } catch (error) {
        const completedAt = new Date();
        const responseTimeMs = completedAt - startedAt;
        lastError = error;

        const errorType = this._classifyError(error);
        console.error(`[SCRAPER] FAILED attempt ${attempt}: ${error.message} (${errorType})`);

        logs.push({
          tracked_product_id: trackedProductId,
          attempt_id: attemptId,
          attempt_number: attempt,
          status: attempt < maxRetries && this._isRetryable(errorType) ? 'RETRIED' : 'FAILED',
          started_at: startedAt,
          completed_at: completedAt,
          response_time_ms: responseTimeMs,
          error_type: errorType,
          error_message: error.message.substring(0, 500),
          extracted_price: null,
          extracted_stock: null,
        });

        // Don't retry non-retryable errors
        if (!this._isRetryable(errorType)) {
          console.log(`[SCRAPER] Non-retryable error: ${errorType}. Stopping.`);
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(
            config.retryBaseDelayMs * Math.pow(2, attempt - 1),
            config.retryMaxDelayMs
          );
          console.log(`[SCRAPER] Waiting ${delay}ms before retry...`);
          await this._sleep(delay);
        }
      }
    }

    // All attempts failed
    console.error(`[SCRAPER] FINAL FAILURE for product ${trackedProductId}: ${lastError?.message}`);
    return {
      success: false,
      data: null,
      logs,
      structureHash: null,
      error: lastError?.message,
    };
  }

  /**
   * Single scrape attempt
   */
  async _attemptScrape(productUrl) {
    const browser = await this.launchBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1
    });

    const page = await context.newPage();
    page.setDefaultTimeout(config.scraperTimeoutMs);

    try {
      // Navigate to product page
      // (Removed webdriver bypass as it triggers advanced anti-bot detection)

      page.on('request', request => {
        if (request.url().includes('/api/')) {
          console.log(`[NETWORK] ${request.method()} ${request.url()} ${request.postData() ? request.postData() : ''}`);
        }
      });

      console.log(`[SCRAPER] Navigating to: ${productUrl}`);
      await page.goto(productUrl, {
        waitUntil: 'load',
        timeout: config.scraperTimeoutMs,
      });

      // Wait for the page to render (React SPA)
      await page.waitForSelector('h1', { timeout: config.scraperTimeoutMs });

      // Dismiss cookie consent if present — MUST complete before mouse interaction
      await this._dismissCookieConsent(page);

      // Extract product title
      const title = await page.textContent('h1');
      console.log(`[SCRAPER] Product title: ${title}`);

      // Extract description
      let description = '';
      try {
        const descEl = await page.$('.product-description, .description');
        if (descEl) {
          description = await descEl.textContent();
        } else {
          // Try to find description by context - the paragraph after brand/sku line
          const paragraphs = await page.$$('p');
          for (const p of paragraphs) {
            const text = await p.textContent();
            if (text && text.length > 30 && !text.includes('Price') && !text.includes('Hover')) {
              description = text.trim();
              break;
            }
          }
        }
      } catch (e) {
        console.log('[SCRAPER] No description found');
      }

      // Get page structure for change detection BEFORE price reveal
      const structureHash = await this._getStructureHash(page);

      // Reveal the price — this is the critical interaction
      const priceData = await this._revealAndExtractPrice(page);

      // Extract stock status — MUST be AFTER price reveal since the stock badge
      // only appears inside .price-facets after the price block transitions to price-success
      const stockStatus = await this._extractStockStatus(page);

      return {
        title: title?.trim(),
        description: description?.trim(),
        price: priceData.price,
        currency: priceData.currency || 'INR',
        stockStatus,
        structureHash,
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Dismiss cookie consent banner AND its full-page overlay.
   * The overlay intercepts ALL pointer events, so we must click the button
   * via JavaScript (bypassing pointer-events) and then force-remove the overlay.
   */
  async _dismissCookieConsent(page) {
    try {
      // Check if cookie overlay exists
      const hasOverlay = await page.evaluate(() => !!document.querySelector('.cookie-overlay'));
      if (!hasOverlay) return; // No cookie banner on this page

      console.log('[SCRAPER] Cookie overlay detected, dismissing...');

      // Click the accept button via JavaScript to bypass the overlay's pointer-events
      const clicked = await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Accept cookies"]')
          || document.querySelector('.cookie-banner button')
          || document.querySelector('.consent-banner button');
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });

      if (clicked) {
        console.log('[SCRAPER] Cookie accept button clicked via JS');
        // Wait for the overlay to be removed by the store's own code
        try {
          await page.waitForSelector('.cookie-overlay', { state: 'detached', timeout: 3000 });
          console.log('[SCRAPER] Cookie overlay removed naturally');
          return;
        } catch (_) {
          // Overlay didn't detach — force remove
        }
      }

      // Force-remove any remaining overlay/banner elements via DOM manipulation
      console.log('[SCRAPER] Force-removing cookie overlay via DOM...');
      await page.evaluate(() => {
        document.querySelectorAll('.cookie-overlay, .cookie-banner, .consent-banner, [class*="cookie-overlay"]').forEach(el => el.remove());
      });
      await page.waitForTimeout(200);

      // Verify removal
      const stillBlocking = await page.evaluate(() => !!document.querySelector('.cookie-overlay'));
      if (stillBlocking) {
        console.log('[SCRAPER] WARNING: Cookie overlay persists, using style override');
        await page.evaluate(() => {
          const el = document.querySelector('.cookie-overlay');
          if (el) el.style.pointerEvents = 'none';
        });
      }
      console.log('[SCRAPER] Cookie overlay handled');
    } catch (e) {
      // Last resort: force-remove any blocking overlays
      console.log('[SCRAPER] Cookie handler error, force-removing:', e.message);
      try {
        await page.evaluate(() => {
          document.querySelectorAll('.cookie-overlay').forEach(el => el.remove());
        });
      } catch (_) {}
    }
  }

  /**
   * Reveal and extract the CURRENT SELLING PRICE.
   *
   * The mock store's price block has three anti-scraping traps:
   * 1. A hidden <span class="price-value" style="display:none"> with a DECOY price
   * 2. A struck-through <span> with the ORIGINAL price (line-through, the first ₹ match in innerText)
   * 3. A hidden <span class="amount" data-price="true" style="display:none"> with another DECOY
   *
   * The REAL current price is inside an <output> element, rendered as individual
   * <span> characters separated by zero-width joiners (U+200D).
   *
   * The reveal button requires a minimum number of mousemove events within the
   * .price-block, spaced ≥40ms apart, plus a minimum dwell time.
   */
  async _revealAndExtractPrice(page) {
    console.log('[SCRAPER] Attempting to reveal price...');

    const MAX_REVEAL_ATTEMPTS = 3;

    for (let revealAttempt = 1; revealAttempt <= MAX_REVEAL_ATTEMPTS; revealAttempt++) {
      console.log(`[SCRAPER] Reveal attempt ${revealAttempt}/${MAX_REVEAL_ATTEMPTS}`);

      try {
        // Add cookie overlay remover (my fix) to ensure cookie overlay doesn't block the click
        await page.evaluate(() => {
          setInterval(() => {
            document.querySelectorAll('.cookie-overlay, [class*="cookie"]').forEach(el => el.remove());
          }, 100);
        });

        // Find the price block bounding box
        const priceBoxBounds = await page.evaluate(() => {
          const el = document.querySelector('.price-block');
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        });

        if (!priceBoxBounds) {
          throw new Error('No .price-block element found on page');
        }

        // We MUST calculate the exact center of the button so we can interpolate perfectly to it
        // The bot detector rejects jumps, so ending at a generic endX/endY and then using page.click()
        // will teleport the mouse and fail the challenge.
        const btnBounds = await page.evaluate(() => {
          const btn = document.querySelector('.price-block button[aria-label="Reveal price"]');
          if (!btn) return null;
          const rect = btn.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        });

        if (!btnBounds) {
          throw new Error('Reveal price button not found in DOM');
        }

        const btnX = btnBounds.x + btnBounds.width / 2;
        const btnY = btnBounds.y + btnBounds.height / 2;

        // Mouse movements must stay WITHIN the price-block bounds.
        // Start near the top-left of the price block
        const startX = priceBoxBounds.x + priceBoxBounds.width * 0.1;
        const startY = priceBoxBounds.y + priceBoxBounds.height * 0.1;

        // Initial mouse enter
        await page.mouse.move(startX, startY);
        await page.waitForTimeout(100);

        // 35 slow moves staying WITHIN the element bounds, ending EXACTLY on the button
        const MOVE_COUNT = 35;
        for (let i = 0; i <= MOVE_COUNT; i++) {
          const t = i / MOVE_COUNT;
          const x = startX + (btnX - startX) * t;
          const y = startY + (btnY - startY) * t;
          await page.mouse.move(x, y);
          await page.waitForTimeout(60);
        }

        // Dwell time before click
        await page.waitForTimeout(3000);

        await page.screenshot({ path: 'before_click.png', fullPage: true });

        // Pure mouse click
        await page.mouse.down();
        await page.waitForTimeout(50);
        await page.mouse.up();
        console.log('[SCRAPER] Clicked Reveal Price button via pure mouse interaction');

        await page.screenshot({ path: 'after_click.png', fullPage: true });

        // Wait for the price block to transition to success state
        await page.waitForSelector('.price-block.price-success, .price-main', { timeout: 10000 });
        console.log('[SCRAPER] Price block loaded');

        // Wait for price to stabilize (the "Updating..." text should clear)
        try {
          await page.waitForFunction(() => {
            const pb = document.querySelector('.price-block');
            return pb && !pb.textContent.includes('Updating');
          }, { timeout: 8000 });
        } catch (_) {
          console.log('[SCRAPER] Price may still be updating, extracting current value');
        }

        // Brief wait for final render
        await page.waitForTimeout(500);

        // Extract the CURRENT selling price from the <output> element
        const price = await this._extractCurrentPrice(page);
        if (price !== null) {
          return { price, currency: 'INR' };
        }

        throw new Error('Price block revealed but could not extract a valid number from <output>');

      } catch (e) {
        await page.screenshot({ path: 'final_state.png', fullPage: true });
        console.log(`[SCRAPER] Reveal attempt ${revealAttempt} failed: ${e.message}`);
        if (revealAttempt >= MAX_REVEAL_ATTEMPTS) {
          throw new Error(`Failed to extract price after ${MAX_REVEAL_ATTEMPTS} reveal attempts: ${e.message}`);
        }
        // Brief wait before retrying the interaction
        await page.waitForTimeout(500);
      }
    }

    throw new Error('Failed to extract price: Price could not be revealed after all strategies');
  }

  /**
   * Extract the CURRENT SELLING PRICE from the revealed price block.
   *
   * The mock store renders the selling price inside an <output> element
   * using individual <span> characters separated by zero-width joiners.
   * This defeats naive regex scraping of document.body.innerText.
   *
   * We read the <output> element's textContent and strip all non-numeric
   * characters (zero-width joiners, currency symbols, spaces).
   */
  async _extractCurrentPrice(page) {
    try {
      const priceData = await page.evaluate(() => {
        // ── Strategy 1: Read the <output> element (the REAL current price) ──
        // The store renders selling price as individual <span> chars with ZWJs.
        const outputEl = document.querySelector('.price-block output, .price-main output');
        if (outputEl) {
          const raw = outputEl.textContent || '';
          // Strip EVERYTHING that's not a digit, comma, or dot
          const cleaned = raw.replace(/[^\d,.]/g, '');
          // Remove commas to get a parseable number
          const numStr = cleaned.replace(/,/g, '');
          const num = parseFloat(numStr);
          if (!isNaN(num) && num > 0 && num < 10000000) {
            return { price: num, source: 'output-element', raw: raw.substring(0, 60) };
          }
        }

        // ── Strategy 2: Check if the price-block has any visible non-struck-through price ──
        const priceMain = document.querySelector('.price-main');
        if (priceMain) {
          const candidates = [];
          for (const child of priceMain.children) {
            const style = window.getComputedStyle(child);
            const isHidden = style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
            const isStruck = style.textDecoration.includes('line-through');
            const isOutput = child.tagName === 'OUTPUT';
            const isAriaHidden = child.getAttribute('aria-hidden') === 'true';
            const text = child.textContent || '';
            const cleaned = text.replace(/[^\d,.]/g, '');
            const num = parseFloat(cleaned.replace(/,/g, ''));
            
            candidates.push({
              tag: child.tagName,
              className: child.className,
              text: text.substring(0, 40),
              isHidden,
              isStruck,
              isOutput,
              isAriaHidden,
              num
            });
            
            if (isHidden || isStruck || isOutput || isAriaHidden) continue;
            
            if (!isNaN(num) && num > 0 && num < 10000000) {
              // Instead of returning the first one immediately, we log them all and pick the best one later
            }
          }
          
          // Print diagnostics to console so Playwright captures it
          console.log('[DOM] Strategy 2 candidates:', JSON.stringify(candidates));
          
          // Let's find the true price by looking for "Deal price" or similar if multiple exist
          // Or just avoid obvious honeypots (like ones with crazy font sizes or wrong formats)
          // For now, let's just pick the one that contains "Deal price" if present, else the first valid one.
          let bestMatch = null;
          for (const c of candidates) {
            if (c.isHidden || c.isStruck || c.isOutput || c.isAriaHidden || isNaN(c.num)) continue;
            
            if (c.text.toLowerCase().includes('deal price')) {
              bestMatch = c;
              break; // Found explicitly labeled deal price
            }
            if (!bestMatch) {
              bestMatch = c;
            }
          }
          
          if (bestMatch) {
             return { price: bestMatch.num, source: 'price-main-child', raw: bestMatch.text };
          }
        }

        // ── INTENTIONALLY SKIPPED ──
        // .price-value (display:none) — HONEYPOT trap
        // .amount[data-price] (display:none) — HONEYPOT trap
        // <span style="line-through"> — ORIGINAL/struck-through price
        // document.body.innerText ₹ regex — would match the WRONG (original) price

        return null;
      });

      if (priceData) {
        console.log(`[SCRAPER] Extracted price ₹${priceData.price} from ${priceData.source} (raw: "${priceData.raw}")`);
        return priceData.price;
      }
    } catch (e) {
      console.log('[SCRAPER] Price extraction error:', e.message);
    }
    return null;
  }

  /**
   * Extract stock/availability status from the .stock-badge element.
   *
   * The stock badge only appears AFTER the price reveal, inside .price-facets.
   * It has CSS classes 'in-stock' or 'out-of-stock' which are the most reliable
   * indicator, with text like "Only 131 left" or "Out of stock" as fallback.
   *
   * If the badge cannot be found, this throws an error so the attempt
   * is retried rather than silently storing UNKNOWN.
   */
  async _extractStockStatus(page) {
    // Wait for the stock badge to appear (it loads with the price reveal)
    try {
      await page.waitForSelector('.stock-badge', { timeout: 5000 });
    } catch (e) {
      // Badge didn't appear — this is a real extraction failure, not "UNKNOWN"
      console.log('[SCRAPER] Stock badge (.stock-badge) not found within timeout');
      throw new Error('Stock badge element (.stock-badge) not found after price reveal');
    }

    const stockData = await page.evaluate(() => {
      const badge = document.querySelector('.stock-badge');
      if (!badge) return null;

      const classes = badge.className.toLowerCase();
      const text = badge.textContent.trim().toLowerCase();

      // Check CSS class first (most reliable)
      if (classes.includes('out-of-stock')) return 'OUT_OF_STOCK';
      if (classes.includes('in-stock')) return 'IN_STOCK';

      // Fallback: check text content
      if (text.includes('out of stock') || text.includes('sold out') || text.includes('unavailable')) return 'OUT_OF_STOCK';
      if (text.includes('in stock') || text.includes('left') || text.includes('available')) return 'IN_STOCK';

      return null;
    });

    if (!stockData) {
      throw new Error('Stock badge found but could not determine status from its class or text');
    }

    console.log(`[SCRAPER] Stock status: ${stockData}`);
    return stockData;
  }

  /**
   * Generate a structure hash for change detection.
   * Ignores dynamic content (prices, timestamps) and focuses on DOM structure.
   */
  async _getStructureHash(page) {
    try {
      const structure = await page.evaluate(() => {
        const getStructure = (el, depth = 0) => {
          if (depth > 10) return '';
          if (!el || !el.tagName) return '';

          const tag = el.tagName.toLowerCase();
          // Skip script, style, svg content
          if (['script', 'style', 'noscript'].includes(tag)) return '';

          const classes = Array.from(el.classList || [])
            .filter(c => !c.match(/^(active|hover|focus|selected|open|closed|visible|hidden|show|hide)/i))
            .sort()
            .join('.');

          let result = `${tag}${classes ? '.' + classes : ''}`;

          // Include children structure (but not text content - that changes with prices)
          const children = [];
          for (const child of el.children) {
            const childStr = getStructure(child, depth + 1);
            if (childStr) children.push(childStr);
          }

          if (children.length > 0) {
            result += `{${children.join(',')}}`;
          }

          return result;
        };

        // Get the main content area structure
        const main = document.querySelector('main, #root > div, .product-detail, .product-page') || document.body;
        return getStructure(main);
      });

      return crypto.createHash('sha256').update(structure || '').digest('hex');
    } catch (e) {
      console.log('[SCRAPER] Structure hash error:', e.message);
      return null;
    }
  }

  /**
   * Validate extracted data.
   * UNKNOWN stock is NOT accepted — if stock couldn't be determined,
   * the extraction should have thrown rather than returning UNKNOWN.
   */
  _validateData(data) {
    const errors = [];

    // Price validation
    if (data.price === null || data.price === undefined) {
      errors.push('Price is null/undefined');
    } else if (typeof data.price !== 'number') {
      errors.push(`Price is not a number: ${typeof data.price}`);
    } else if (isNaN(data.price)) {
      errors.push('Price is NaN');
    } else if (data.price < 0) {
      errors.push(`Price is negative: ${data.price}`);
    } else if (data.price === 0) {
      errors.push('Price is zero');
    }

    // Stock validation — only IN_STOCK and OUT_OF_STOCK are accepted
    const validStocks = ['IN_STOCK', 'OUT_OF_STOCK'];
    if (!validStocks.includes(data.stockStatus)) {
      errors.push(`Invalid or missing stock status: ${data.stockStatus}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Classify an error for retry decisions
   */
  _classifyError(error) {
    const msg = error.message?.toLowerCase() || '';

    if (msg.includes('timeout') || msg.includes('timed out')) return 'TIMEOUT';
    if (msg.includes('net::') || msg.includes('connection') || msg.includes('econnrefused')) return 'NETWORK_ERROR';
    if (msg.includes('navigation failed') || msg.includes('net::err_')) return 'NAVIGATION_ERROR';
    if (msg.includes('protocol error') || msg.includes('target closed')) return 'BROWSER_ERROR';
    if (msg.includes('validation failed')) return 'VALIDATION_ERROR';
    // Extraction errors must be checked BEFORE generic 'not found' — these messages
    // contain 'not found' but are retryable extraction failures, not 404s.
    if (msg.includes('stock badge') || msg.includes('price could not be revealed') || msg.includes('reveal attempt')) return 'EXTRACTION_ERROR';
    if (msg.includes('not found') || msg.includes('404')) return 'NOT_FOUND';

    return 'UNKNOWN_ERROR';
  }

  /**
   * Determine if an error type is retryable
   */
  _isRetryable(errorType) {
    const retryable = ['TIMEOUT', 'NETWORK_ERROR', 'NAVIGATION_ERROR', 'BROWSER_ERROR', 'EXTRACTION_ERROR', 'UNKNOWN_ERROR'];
    return retryable.includes(errorType);
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Scrape listing page to build product catalog
   */
  async scrapeListingPage(pageNumber = 1) {
    const browser = await this.launchBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(config.scraperTimeoutMs);

    try {
      // Navigate to store
      await page.goto(config.ineStoreUrl, {
        waitUntil: 'networkidle',
        timeout: config.scraperTimeoutMs,
      });

      // Wait for product tiles to appear
      await page.waitForSelector('.tile-cta, button:has-text("View details")', { timeout: config.scraperTimeoutMs });

      // Dismiss cookie consent
      await this._dismissCookieConsent(page);

      // Navigate to the requested page
      for (let i = 1; i < pageNumber; i++) {
        const nextBtn = await page.$('button:has-text("Next")');
        if (nextBtn) {
          await nextBtn.click();
          await page.waitForTimeout(1000);
        }
      }

      // Extract products from current page
      const products = await page.evaluate((storeUrl) => {
        const tiles = document.querySelectorAll('.tile, [class*="product-card"], article');
        const results = [];

        for (const tile of tiles) {
          try {
            // Get the View details link/button
            const ctaBtn = tile.querySelector('.tile-cta, button');
            if (!ctaBtn) continue;

            // Get product info text content
            const allText = tile.textContent;

            // Extract category (usually first text element, uppercase)
            const categoryEl = tile.querySelector('[class*="category"], [class*="tag"]');
            const category = categoryEl ? categoryEl.textContent.trim() : '';

            // Extract title (the main heading)
            const titleEl = tile.querySelector('h2, h3, [class*="title"], [class*="name"]');
            const title = titleEl ? titleEl.textContent.trim() : '';

            // Extract brand and SKU from remaining text
            let brand = '';
            let sku = '';
            const textParts = allText.split('\n').map(s => s.trim()).filter(Boolean);
            for (const part of textParts) {
              if (part.match(/^SKU\s/i)) {
                sku = part.replace(/^SKU\s*/i, '');
              } else if (part !== category && part !== title && !part.includes('View') && part.length < 30) {
                if (!brand) brand = part;
              }
            }

            // Extract product ID from any link
            const link = tile.querySelector('a[href*="/product/"]');
            let productId = '';
            if (link) {
              const href = link.getAttribute('href');
              const match = href.match(/\/product\/(\d+)/);
              if (match) productId = match[1];
            }

            // If no link, try to extract ID from SKU
            if (!productId && sku) {
              const skuMatch = sku.match(/\d+$/);
              if (skuMatch) {
                productId = String(parseInt(skuMatch[0]) - 10000);
              }
            }

            if (title && productId) {
              results.push({
                external_product_id: productId,
                sku: sku || null,
                name: title,
                url: `${storeUrl}/product/${productId}`,
                category: category || null,
                brand: brand || null,
              });
            }
          } catch (e) {
            console.error('Error extracting tile:', e);
          }
        }

        return results;
      }, config.ineStoreUrl);

      // Get total pages
      const pageInfo = await page.evaluate(() => {
        const pageText = document.body.innerText;
        const match = pageText.match(/Page\s+(\d+)\s+of\s+(\d+)/);
        return match ? { current: parseInt(match[1]), total: parseInt(match[2]) } : { current: 1, total: 1 };
      });

      return { products, pageInfo };
    } finally {
      await context.close();
    }
  }

  /**
   * Scrape multiple listing pages to build full catalog.
   * Follows pagination until there is no next page (or maxPages is reached).
   *
   * @param {number} maxPages - Safety limit. Default 200 (covers any realistic catalog).
   */
  async scrapeCatalog(maxPages = 200) {
    const allProducts = [];
    let pagesScraped = 0;

    console.log(`[SCRAPER] Building catalog (max ${maxPages} pages, will follow pagination)...`);

    const browser = await this.launchBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(config.scraperTimeoutMs);

    try {
      // Navigate to store
      await page.goto(config.ineStoreUrl, {
        waitUntil: 'networkidle',
        timeout: config.scraperTimeoutMs,
      });

      await page.waitForSelector('.tile-cta, button:has-text("View details")', { timeout: config.scraperTimeoutMs });
      await this._dismissCookieConsent(page);

      // Log detected total if available
      const detectedTotal = await page.evaluate(() => {
        const pageText = document.body.innerText;
        const match = pageText.match(/Page\s+\d+\s+of\s+(\d+)/);
        return match ? parseInt(match[1]) : null;
      });
      if (detectedTotal) {
        console.log(`[SCRAPER] Store reports ${detectedTotal} total pages`);
      }

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        console.log(`[SCRAPER] Scraping listing page ${pageNum}...`);
        
        await this._dismissCookieConsent(page);

        // Extract products from current page
        const products = await page.evaluate((storeUrl) => {
          const tiles = document.querySelectorAll('.tile, [class*="product-card"], article');
          const results = [];

          for (const tile of tiles) {
            try {
              // Get the View details link/button
              const ctaBtn = tile.querySelector('.tile-cta, button');
              if (!ctaBtn) continue;

              // Extract category
              const categoryEl = tile.querySelector('.tile-category, [class*="category"]');
              const category = categoryEl ? categoryEl.textContent.trim() : '';

              // Extract title
              const titleEl = tile.querySelector('.tile-name, h2, h3');
              const title = titleEl ? titleEl.textContent.trim() : '';

              // Extract brand
              const brandEl = tile.querySelector('.tile-brand, [class*="brand"]');
              const brand = brandEl ? brandEl.textContent.trim() : '';

              // Extract SKU
              const skuEl = tile.querySelector('.tile-sku, [class*="sku"]');
              let sku = skuEl ? skuEl.textContent.trim() : '';
              if (sku.match(/^SKU\s/i)) sku = sku.replace(/^SKU\s*/i, '');

              // Extract product ID from any link or fallback to SKU calculation
              let productId = '';
              const link = tile.querySelector('a[href*="/product/"]');
              if (link) {
                const href = link.getAttribute('href');
                const match = href.match(/\/product\/(\d+)/);
                if (match) productId = match[1];
              }

              if (!productId && sku) {
                const skuMatch = sku.match(/\d+$/);
                if (skuMatch) {
                  productId = String(parseInt(skuMatch[0]) - 10000);
                }
              }

              if (title && productId) {
                results.push({
                  external_product_id: productId,
                  sku: sku || null,
                  name: title,
                  url: `${storeUrl}/product/${productId}`,
                  category: category || null,
                  brand: brand || null,
                });
              }
            } catch (e) {
              console.error('Error extracting tile:', e);
            }
          }

          return results;
        }, config.ineStoreUrl);

        allProducts.push(...products);
        pagesScraped = pageNum;
        console.log(`[SCRAPER] Page ${pageNum}: Found ${products.length} products (total: ${allProducts.length})`);

        // Try to navigate to next page — stop if no Next button or it's disabled
        const nextBtn = await page.$('button:has-text("Next")');
        if (!nextBtn) {
          console.log('[SCRAPER] No Next button found — reached last page');
          break;
        }
        const isDisabled = await nextBtn.isDisabled();
        if (isDisabled) {
          console.log('[SCRAPER] Next button is disabled — reached last page');
          break;
        }

        await nextBtn.click();
        await page.waitForTimeout(1500);
      }
    } finally {
      await context.close();
    }

    console.log(`[SCRAPER] Catalog complete: ${allProducts.length} products across ${pagesScraped} pages`);
    return allProducts;
  }
}

// Singleton instance
const scraperService = new ScraperService();

module.exports = scraperService;
