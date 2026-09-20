let dynamicSettings = { defaultScrapeFrequencyMinutes: 120, maxRetries: 3, notifyPriceDrop: true, notifyBackInStock: true }; 
module.exports = { 
  get: () => dynamicSettings, 
  update: (newSettings) => { 
    dynamicSettings = { ...dynamicSettings, ...newSettings }; 
    return dynamicSettings; 
  } 
};
