/**
 * Alert Service — generates and delivers price-drop and back-in-stock alerts
 */
const alertRepository = require('../../repositories/alertRepository');
const config = require('../../config');

const alertService = {
  /**
   * Check and generate alerts based on current vs previous data
   */
  async checkAndCreateAlerts(trackedProductId, currentData, previousData) {
    const alerts = [];

    if (!previousData || !currentData) {
      return alerts;
    }

    const isPriceDrop = currentData.price && previousData.price && currentData.price < previousData.price;
    const isOutOfStock = previousData.stock_status === 'IN_STOCK' && currentData.stockStatus === 'OUT_OF_STOCK';
    const isBackInStock = previousData.stock_status === 'OUT_OF_STOCK' && currentData.stockStatus === 'IN_STOCK';

    // Out of Stock Alert (Primary if both OOS and Price Drop happen)
    if (isOutOfStock) {
      const duplicate = await alertRepository.checkDuplicate(
        trackedProductId,
        'OUT_OF_STOCK',
        'OUT_OF_STOCK'
      );

      if (!duplicate) {
        let oldVal = 'IN_STOCK';
        let newVal = 'OUT_OF_STOCK';
        
        // If price also dropped during this SAME scrape, store price delta in the OOS alert
        if (isPriceDrop) {
          oldVal = String(previousData.price);
          newVal = String(currentData.price);
        }

        const alert = await alertRepository.create({
          tracked_product_id: trackedProductId,
          alert_type: 'OUT_OF_STOCK',
          old_value: oldVal,
          new_value: newVal,
          message: isPriceDrop ? `Product is now out of stock. Price also dropped from ₹${previousData.price} to ₹${currentData.price}.` : `Product is now out of stock. Current price: ₹${currentData.price || previousData.price}`,
          delivery_status: 'IN_APP',
        });
        alerts.push(alert);
        console.log('[ALERTS] Out-of-stock alert created');

        await this._tryEmailDelivery(alert, 'Out of Stock Alert');
      }
    } 
    // Price Drop Alert (Only if it didn't just go out of stock)
    else if (isPriceDrop) {
      const priceDiff = previousData.price - currentData.price;
      const percentChange = ((priceDiff / previousData.price) * 100).toFixed(2);

      // Check for duplicate
      const duplicate = await alertRepository.checkDuplicate(
        trackedProductId,
        'PRICE_DROP',
        String(currentData.price)
      );

      if (!duplicate) {
        const alert = await alertRepository.create({
          tracked_product_id: trackedProductId,
          alert_type: 'PRICE_DROP',
          old_value: String(previousData.price),
          new_value: String(currentData.price),
          message: `Price dropped from ₹${previousData.price} to ₹${currentData.price} (↓ ₹${priceDiff.toFixed(2)}, ${percentChange}% decrease)`,
          delivery_status: 'IN_APP',
        });
        alerts.push(alert);
        console.log(`[ALERTS] Price drop alert created: ₹${previousData.price} → ₹${currentData.price}`);

        // Try email delivery
        await this._tryEmailDelivery(alert, 'Price Drop Alert');
      }
    }

    // Back-in-Stock Alert
    if (isBackInStock) {
      const duplicate = await alertRepository.checkDuplicate(
        trackedProductId,
        'BACK_IN_STOCK',
        'IN_STOCK'
      );

      if (!duplicate) {
        const alert = await alertRepository.create({
          tracked_product_id: trackedProductId,
          alert_type: 'BACK_IN_STOCK',
          old_value: 'OUT_OF_STOCK',
          new_value: 'IN_STOCK',
          message: 'Product is back in stock!',
          delivery_status: 'IN_APP',
        });
        alerts.push(alert);
        console.log('[ALERTS] Back-in-stock alert created');

        await this._tryEmailDelivery(alert, 'Back in Stock Alert');
      }
    }

    return alerts;
  },

  /**
   * Create a structure change alert
   */
  async createStructureChangeAlert(trackedProductId, details) {
    const duplicate = await alertRepository.checkDuplicate(
      trackedProductId,
      'STRUCTURE_CHANGE',
      details.newHash
    );

    if (!duplicate) {
      const alert = await alertRepository.create({
        tracked_product_id: trackedProductId,
        alert_type: 'STRUCTURE_CHANGE',
        old_value: details.oldHash?.substring(0, 16),
        new_value: details.newHash?.substring(0, 16),
        message: `Page structure change detected. ${details.changedFields || 'DOM structure modified.'}`,
        delivery_status: 'IN_APP',
      });
      console.log('[ALERTS] Structure change alert created');
      return alert;
    }
    return null;
  },

  /**
   * Try to send email alert via SendGrid (optional)
   */
  async _tryEmailDelivery(alert, subject) {
    if (!config.sendgridApiKey || !config.alertFromEmail || !config.alertToEmail) {
      return; // Email not configured, skip silently
    }

    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(config.sendgridApiKey);

      const msg = {
        to: config.alertToEmail,
        from: config.alertFromEmail,
        subject: `[Price Tracker] ${subject}`,
        text: alert.message,
        html: `<h2>${subject}</h2><p>${alert.message}</p>`,
      };

      await sgMail.send(msg);
      
      // Update delivery status
      await alertRepository.markRead(alert.id); // Using markRead to update
      console.log(`[ALERTS] Email sent to ${config.alertToEmail}`);
    } catch (error) {
      console.log('[ALERTS] Email delivery failed (non-critical):', error.message);
    }
  },
};

module.exports = alertService;
