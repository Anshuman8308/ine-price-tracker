const schedulerService = require('../src/services/scheduler/schedulerService');
const trackedProductRepository = require('../src/repositories/trackedProductRepository');
const alertService = require('../src/services/alerts/alertService');
const scraperService = require('../src/services/scraper/scraperService');
const priceHistoryRepository = require('../src/repositories/priceHistoryRepository');

// Mock dependencies
jest.mock('../src/repositories/trackedProductRepository');
jest.mock('../src/repositories/priceHistoryRepository');
jest.mock('../src/repositories/scrapeLogRepository');
jest.mock('../src/repositories/pageSnapshotRepository');
jest.mock('../src/services/alerts/alertService');
jest.mock('../src/services/scraper/scraperService');

describe('Scheduler Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('runScheduledScrapes processes due products and returns summary', async () => {
    // Mock 2 due products
    const mockProducts = [
      { id: 1, url: 'url1', scrape_frequency_minutes: 120 },
      { id: 2, url: 'url2', scrape_frequency_minutes: 120 }
    ];
    trackedProductRepository.findDueProducts.mockResolvedValue(mockProducts);
    
    // Mock scraper success
    scraperService.scrapeProduct.mockResolvedValue({
      success: true,
      data: { price: 100, stockStatus: 'IN_STOCK' },
      logs: [],
      structureHash: 'hash123'
    });
    
    // Mock other DB calls
    priceHistoryRepository.getLatest.mockResolvedValue(null);
    trackedProductRepository.updateAfterScrape.mockResolvedValue();

    const result = await schedulerService.runScheduledScrapes();

    expect(trackedProductRepository.findDueProducts).toHaveBeenCalled();
    expect(scraperService.scrapeProduct).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
  });

  test('runScheduledScrapes handles empty due products gracefully', async () => {
    trackedProductRepository.findDueProducts.mockResolvedValue([]);
    
    const result = await schedulerService.runScheduledScrapes();

    expect(scraperService.scrapeProduct).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
  });

  test('scrapeTrackedProduct handles scraper failure gracefully', async () => {
    const mockProduct = { id: 1, url: 'url1', scrape_frequency_minutes: 120 };
    
    // Scraper fails
    scraperService.scrapeProduct.mockResolvedValue({
      success: false,
      data: null,
      logs: [],
      error: 'Timeout'
    });

    const result = await schedulerService._scrapeTrackedProduct(mockProduct);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Timeout');
    // Ensure timestamps are updated even on failure
    expect(trackedProductRepository.updateAfterScrape).toHaveBeenCalled();
    // Ensure no price history is created
    expect(priceHistoryRepository.create).not.toHaveBeenCalled();
  });
});
