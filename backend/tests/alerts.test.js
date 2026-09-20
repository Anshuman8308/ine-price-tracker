const alertService = require('../src/services/alerts/alertService');
const alertRepository = require('../src/repositories/alertRepository');

// Mock repository
jest.mock('../src/repositories/alertRepository', () => ({
  checkDuplicate: jest.fn(),
  create: jest.fn(),
  markRead: jest.fn()
}));

// Mock config
jest.mock('../src/config', () => ({
  sendgridApiKey: null // disable email sending for tests
}));

describe('Alert Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates PRICE_DROP alert when price decreases', async () => {
    alertRepository.checkDuplicate.mockResolvedValue(false);
    alertRepository.create.mockResolvedValue({ id: 1, message: 'Test Alert' });

    const currentData = { price: 80.00 };
    const previousData = { price: 100.00 };

    const alerts = await alertService.checkAndCreateAlerts(1, currentData, previousData);
    
    expect(alerts.length).toBe(1);
    expect(alertRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      alert_type: 'PRICE_DROP',
      old_value: '100',
      new_value: '80'
    }));
  });

  test('does NOT create PRICE_DROP alert when price increases or stays same', async () => {
    const currentData = { price: 120.00 };
    const previousData = { price: 100.00 };

    const alerts = await alertService.checkAndCreateAlerts(1, currentData, previousData);
    
    expect(alerts.length).toBe(0);
    expect(alertRepository.create).not.toHaveBeenCalled();
  });

  test('creates BACK_IN_STOCK alert when status changes from OUT_OF_STOCK to IN_STOCK', async () => {
    alertRepository.checkDuplicate.mockResolvedValue(false);
    alertRepository.create.mockResolvedValue({ id: 2, message: 'In stock' });

    const currentData = { price: 100, stockStatus: 'IN_STOCK' };
    const previousData = { price: 100, stock_status: 'OUT_OF_STOCK' };

    const alerts = await alertService.checkAndCreateAlerts(1, currentData, previousData);
    
    expect(alerts.length).toBe(1);
    expect(alertRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      alert_type: 'BACK_IN_STOCK',
      old_value: 'OUT_OF_STOCK',
      new_value: 'IN_STOCK'
    }));
  });
});
