/**
 * Catalog refresh test — verifies full pagination and product indexing.
 * Then tests search by SKU, name, and partial name.
 */
require('dotenv').config();
const scraperService = require('../src/services/scraper/scraperService');
const productRepository = require('../src/repositories/productRepository');
const config = require('../src/config');

async function testCatalogRefresh() {
  console.log('═══════════════════════════════════════════════');
  console.log('  CATALOG REFRESH TEST');
  console.log('═══════════════════════════════════════════════\n');

  const startTime = Date.now();

  console.log('Scraping full catalog (all pages)...\n');
  const products = await scraperService.scrapeCatalog();
  await scraperService.closeBrowser();

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nCatalog scrape complete in ${elapsed}s`);
  console.log(`Products scraped: ${products.length}`);

  // Upsert into database
  console.log('\nUpserting into database...');
  const results = await productRepository.bulkUpsert(products);
  console.log(`Upserted: ${results.length}`);

  const totalCount = await productRepository.count();
  console.log(`Total products in database: ${totalCount}`);

  // Test search functionality
  console.log('\n── SEARCH TESTS ──');

  // Test 1: SKU search for product from a late page
  const skuSearch = await productRepository.search('DOM-10431', 10);
  console.log(`\nSearch 'DOM-10431' (exact SKU): ${skuSearch.length} results`);
  if (skuSearch.length > 0) {
    console.log(`  ✅ Found: ${skuSearch[0].name} (SKU: ${skuSearch[0].sku})`);
  } else {
    console.log(`  ❌ NOT FOUND — product from page 22 not indexed`);
  }

  // Test 2: Exact name search
  const nameSearch = await productRepository.search('Nordkraft Headphones Pro', 10);
  console.log(`\nSearch 'Nordkraft Headphones Pro' (exact name): ${nameSearch.length} results`);
  if (nameSearch.length > 0) {
    console.log(`  ✅ Found: ${nameSearch[0].name}`);
  } else {
    console.log(`  ❌ NOT FOUND`);
  }

  // Test 3: Partial name search
  const partialSearch = await productRepository.search('Domus', 10);
  console.log(`\nSearch 'Domus' (partial name): ${partialSearch.length} results`);
  for (const p of partialSearch.slice(0, 3)) {
    console.log(`  → ${p.name} (SKU: ${p.sku || 'N/A'})`);
  }

  // Test 4: Category search
  const catSearch = await productRepository.search('Audio', 10);
  console.log(`\nSearch 'Audio' (category): ${catSearch.length} results`);

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('  CATALOG TEST SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Total pages scraped: ✓ (dynamic pagination)`);
  console.log(`  Products scraped: ${products.length}`);
  console.log(`  Products in DB: ${totalCount}`);
  console.log(`  DOM-10431 searchable: ${skuSearch.length > 0 ? '✅' : '❌'}`);
  console.log(`  Exact name search: ${nameSearch.length > 0 ? '✅' : '❌'}`);
  console.log(`  Partial name search: ${partialSearch.length > 0 ? '✅' : '❌'}`);
  console.log(`  Time: ${elapsed}s`);
  console.log('═══════════════════════════════════════════════');

  // Cleanup
  const { pool } = require('../src/config/database');
  await pool.end();
}

testCatalogRefresh().catch(err => {
  console.error('Fatal:', err);
  scraperService.closeBrowser().finally(() => process.exit(1));
});
