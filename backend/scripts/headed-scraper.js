/**
 * Headed Scraper Script — runs Playwright in headed (visible) mode
 * 
 * Usage: npm run scraper:headed
 * 
 * This script:
 * 1. Sets HEADED=true to launch Playwright visibly.
 * 2. Uses the exact same ScraperService logic to avoid divergence.
 * 3. Demonstrates timeout/failure handling by temporarily lowering the timeout.
 * 4. Extracts a real price to verify it works.
 */
require('dotenv').config();

// Force headed mode and slower execution
process.env.HEADED = 'true';

const scraperService = require('../src/services/scraper/scraperService');
const config = require('../src/config');

const DEMO_PRODUCT_ID = process.argv[2] || '160';
const DEMO_URL = `${config.ineStoreUrl}/product/${DEMO_PRODUCT_ID}`;

async function runHeadedScraper() {
  console.log('═══════════════════════════════════════════════');
  console.log('  INE Product Price Tracker — Headed Scraper');
  console.log('═══════════════════════════════════════════════');
  console.log();
  
  try {
    // ---------------------------------------------------------
    // DEMONSTRATION 1: TIMEOUT AND RETRY HANDLING
    // ---------------------------------------------------------
    console.log('📌 PHASE 1: Demonstrating failure and retry logic');
    console.log('   Temporarily reducing timeout to force a failure...');
    
    // Save original timeout
    const originalTimeout = config.scraperTimeoutMs;
    const originalBaseDelay = config.retryBaseDelayMs;
    
    // Force fail on first attempt by setting a 1ms timeout, 
    // and speed up retries so we don't wait forever.
    config.scraperTimeoutMs = 1; 
    config.retryBaseDelayMs = 2000;
    
    // We expect this to fail initially, and we will watch it retry.
    // The scraper logs will show "TIMEOUT" errors.
    console.log(`   ⏳ Attempting to scrape with 1ms timeout...`);
    const failPromise = scraperService.scrapeProduct(DEMO_URL, -1);
    
    // After 1 second, restore the timeout so the retry succeeds!
    setTimeout(() => {
      console.log('   🔧 Restoring normal timeout for the retry attempt...');
      config.scraperTimeoutMs = originalTimeout;
      config.retryBaseDelayMs = originalBaseDelay;
    }, 1500);
    
    const failResult = await failPromise;
    console.log();
    console.log('   📊 Phase 1 Scrape Logs:');
    failResult.logs.forEach(log => {
      console.log(`      Attempt ${log.attempt_number}: ${log.status} ${log.error_type ? '(' + log.error_type + ')' : ''}`);
    });
    console.log('   ✓ Phase 1 complete. (If SUCCESS is seen, the retry mechanism worked!)');
    console.log();
    
    // Close browser to start fresh for Phase 2
    await scraperService.closeBrowser();

    // ---------------------------------------------------------
    // DEMONSTRATION 2: SUCCESSFUL REVEAL AND EXTRACTION
    // ---------------------------------------------------------
    console.log('📌 PHASE 2: Normal execution and exact price extraction');
    console.log(`   Navigating to product: ${DEMO_URL}`);
    
    // We will launch the browser manually to add slowMo, but scraperService doesn't 
    // expose slowMo currently. However, the exact mouse moves are already 60ms apart,
    // which is very visible.
    
    const result = await scraperService.scrapeProduct(DEMO_URL, -2);
    
    console.log();
    console.log('═══════════════════════════════════════════════');
    console.log('  Scrape Results Summary');
    console.log('═══════════════════════════════════════════════');
    if (result.success) {
      console.log(`  Product: ${result.data.title}`);
      console.log(`  Price: ₹${result.data.price}`);
      console.log(`  Stock: ${result.data.stockStatus}`);
      console.log(`  Hash:  ${result.data.structureHash}`);
    } else {
      console.log(`  ❌ Failed to extract: ${result.error}`);
    }
    console.log('═══════════════════════════════════════════════');
    console.log();
    
    // Keep browser open for a moment
    console.log('📸 Browser will stay open for 5 seconds for recording...');
    await new Promise(r => setTimeout(r, 5000));
    
  } catch (error) {
    console.error('❌ Error during headed scrape:', error.message);
  } finally {
    await scraperService.closeBrowser();
    console.log('🏁 Headed scraper complete');
  }
}

runHeadedScraper().catch(console.error);
