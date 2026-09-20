const scraperService = require('../src/services/scraper/scraperService');
const config = require('../src/config');

describe('Scraper Service - Error Classification & Retry Logic', () => {
  test('classifies TIMEOUT error correctly', () => {
    const error = new Error('page.goto: Timeout 30000ms exceeded.');
    const type = scraperService._classifyError(error);
    expect(type).toBe('TIMEOUT');
  });

  test('classifies EXTRACTION_ERROR correctly for price reveal failure', () => {
    const error = new Error('Failed to extract price: Price could not be revealed after all strategies');
    const type = scraperService._classifyError(error);
    expect(type).toBe('EXTRACTION_ERROR');
  });

  test('classifies EXTRACTION_ERROR for stock badge failure', () => {
    const error = new Error('Stock badge element (.stock-badge) not found after price reveal');
    const type = scraperService._classifyError(error);
    expect(type).toBe('EXTRACTION_ERROR');
  });

  test('determines retryability correctly', () => {
    expect(scraperService._isRetryable('TIMEOUT')).toBe(true);
    expect(scraperService._isRetryable('EXTRACTION_ERROR')).toBe(true);
  });

  test('validates valid data', () => {
    const data = { price: 199.99, stockStatus: 'IN_STOCK' };
    const result = scraperService._validateData(data);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test('invalidates missing price', () => {
    const data = { price: null, stockStatus: 'IN_STOCK' };
    const result = scraperService._validateData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Price is null/undefined');
  });

  test('invalidates invalid stock status', () => {
    const data = { price: 199.99, stockStatus: 'WEIRD_STOCK' };
    const result = scraperService._validateData(data);
    expect(result.valid).toBe(false);
  });

  test('rejects UNKNOWN stock status (must be IN_STOCK or OUT_OF_STOCK)', () => {
    const data = { price: 199.99, stockStatus: 'UNKNOWN' };
    const result = scraperService._validateData(data);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Invalid or missing stock status/);
  });
});
