import { useState, useEffect, useCallback } from 'react';
import { getAlerts, markAlertRead, markAllAlertsRead } from '../services/api';
import { Bell, CheckCircle2, TrendingDown, Clock, Package, AlertTriangle, SearchX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../utils/cn';

type AlertFilter = 'ALL' | 'PRICE_DROP' | 'BACK_IN_STOCK' | 'OUT_OF_STOCK';

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AlertFilter>('ALL');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAlerts();
      if (data.success) {
        setAlerts(data.data.alerts || []);
      } else {
        setError('Failed to load alerts from server.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while fetching alerts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleMarkRead = async (id: number) => {
    try {
      // Optimistic update
      setAlerts(alerts.map(a => a.id === id ? { ...a, is_read: true } : a));
      await markAlertRead(id);
    } catch (err) {
      console.error(err);
      // Revert if error (simplified here)
      fetchAlerts();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setAlerts(alerts.map(a => ({ ...a, is_read: true })));
      await markAllAlertsRead();
    } catch (err) {
      console.error(err);
    }
  };

  const displayableAlerts = alerts.filter(a => a.alert_type !== 'STRUCTURE_CHANGE');
  const unreadCount = displayableAlerts.filter(a => !a.is_read).length;

  const filteredAlerts = displayableAlerts.filter(alert => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PRICE_DROP') return alert.alert_type === 'PRICE_DROP';
    if (activeTab === 'BACK_IN_STOCK') return alert.alert_type === 'BACK_IN_STOCK' || (alert.alert_type === 'STOCK_CHANGE' && alert.new_value === 'IN_STOCK');
    if (activeTab === 'OUT_OF_STOCK') return alert.alert_type === 'OUT_OF_STOCK' || (alert.alert_type === 'STOCK_CHANGE' && alert.new_value === 'OUT_OF_STOCK');
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold font-outfit text-slate-900">Your Alerts</h2>
          <p className="text-slate-500">Stay updated on price drops and restocks.</p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-px overflow-x-auto">
        <TabButton active={activeTab === 'ALL'} onClick={() => setActiveTab('ALL')} label="All Alerts" />
        <TabButton active={activeTab === 'PRICE_DROP'} onClick={() => setActiveTab('PRICE_DROP')} label="Price Drops" />
        <TabButton active={activeTab === 'BACK_IN_STOCK'} onClick={() => setActiveTab('BACK_IN_STOCK')} label="Back in Stock" />
        <TabButton active={activeTab === 'OUT_OF_STOCK'} onClick={() => setActiveTab('OUT_OF_STOCK')} label="Out of Stock" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Clock className="animate-spin w-8 h-8 text-blue-500" /></div>
      ) : error ? (
        <div className="bg-red-50 rounded-2xl border border-red-100 p-12 text-center shadow-sm">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Oops! Something went wrong</h3>
          <p className="text-red-600 mb-6">{error}</p>
          <button onClick={fetchAlerts} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors">
            Try Again
          </button>
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No alerts yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-6">
            We'll notify you here when the products you are tracking drop in price or come back in stock.
          </p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <SearchX className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No results</h3>
          <p className="text-slate-500">No alerts match the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => {
            const isPriceDrop = alert.alert_type === 'PRICE_DROP';
            const isOutOfStock = alert.alert_type === 'OUT_OF_STOCK' || alert.new_value === 'OUT_OF_STOCK';
            const alertTitle = isPriceDrop ? 'Price Drop' : isOutOfStock ? 'Product Out of Stock' : 'Back in Stock';
            
            // Generate semantic messages
            let semanticMessage = alert.message;
            if (!isPriceDrop) {
               semanticMessage = isOutOfStock ? 'This product is no longer available.' : 'This product is available again.';
            }

            // Calculate diff and price rendering
            let diffString = '';
            let showPriceCross = false;
            let currentPriceOnly = null;
            let oldPriceVal = null;
            let newPriceVal = null;
            
            if (alert.old_value && alert.new_value) {
                const oldPrice = parseFloat(alert.old_value);
                const newPrice = parseFloat(alert.new_value);
                
                if (!isNaN(oldPrice) && !isNaN(newPrice)) {
                    oldPriceVal = oldPrice;
                    newPriceVal = newPrice;
                    if (oldPrice !== newPrice) {
                        showPriceCross = true;
                        const diff = oldPrice - newPrice;
                        const percent = ((Math.abs(diff) / oldPrice) * 100).toFixed(2);
                        if (diff > 0) {
                            diffString = `↓ ₹${diff.toLocaleString()} · ${percent}% decrease`;
                        } else {
                            diffString = `↑ ₹${Math.abs(diff).toLocaleString()} · ${percent}% increase`;
                        }
                    } else if (isOutOfStock) {
                        currentPriceOnly = newPrice;
                    }
                }
            }

            // If it's OUT_OF_STOCK but old_value wasn't numeric, we still need current price if passed in message
            if (isOutOfStock && !currentPriceOnly && !showPriceCross) {
                 const priceMatch = alert.message?.match(/Current price: ₹([0-9.]+)/);
                 if (priceMatch && priceMatch[1]) {
                     currentPriceOnly = parseFloat(priceMatch[1]);
                 }
            }
            
            // Safely parse date to prevent rendering crashes
            let timeAgo = 'recently';
            try {
              if (alert.triggered_at) {
                timeAgo = formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true });
              } else if (alert.created_at) {
                timeAgo = formatDistanceToNow(new Date(alert.created_at), { addSuffix: true });
              }
            } catch (_e) {
              // fallback
            }

            return (
              <div 
                key={alert.id} 
                className={cn(
                  "bg-white rounded-2xl border p-5 flex flex-col sm:flex-row gap-5 transition-all shadow-sm group",
                  !alert.is_read ? "border-blue-200 ring-1 ring-blue-100 bg-blue-50/20" : "border-slate-200 hover:shadow-md hover:border-slate-300"
                )}
              >
                <div className={cn(
                  "mt-1 w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border",
                  isPriceDrop ? "bg-green-50 text-green-600 border-green-100" : isOutOfStock ? "bg-red-50 text-red-600 border-red-100" : "bg-blue-50 text-blue-600 border-blue-100"
                )}>
                  {isPriceDrop ? <TrendingDown className="w-6 h-6" /> : isOutOfStock ? <AlertTriangle className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <h4 className={cn("font-bold text-lg truncate", !alert.is_read ? "text-slate-900" : "text-slate-700")}>
                      {alertTitle}
                    </h4>
                    <span className="text-xs font-semibold text-slate-400 whitespace-nowrap mt-1 uppercase tracking-wider">
                      {timeAgo}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <p className={cn("text-sm font-semibold mb-1", !alert.is_read ? "text-slate-800" : "text-slate-700")}>
                      {alert.product_name || `Product #${alert.tracked_product_id}`}
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-3">{semanticMessage}</p>
                    
                    {showPriceCross && oldPriceVal !== null && newPriceVal !== null && (
                      <p className="text-xl font-bold font-outfit text-slate-800 mb-1">
                        <span className="line-through text-slate-400 font-medium text-lg mr-2">₹{oldPriceVal.toLocaleString()}</span>
                        <span className={oldPriceVal > newPriceVal ? "text-green-600" : "text-red-600"}>₹{newPriceVal.toLocaleString()}</span>
                      </p>
                    )}
                    {currentPriceOnly !== null && (
                      <p className="text-sm font-medium text-slate-700 bg-slate-50 w-fit px-2 py-0.5 rounded border border-slate-100 mb-2">
                        Current price: ₹{currentPriceOnly.toLocaleString()}
                      </p>
                    )}
                    {diffString && (
                       <p className={cn(
                           "text-sm font-medium w-fit px-2 py-0.5 rounded border mb-2",
                           diffString.includes('decrease') ? "text-green-700 bg-green-50 border-green-100" : "text-red-700 bg-red-50 border-red-100"
                       )}>{diffString}</p>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
                    <div className="flex gap-2">
                    </div>
                    
                    {!alert.is_read && (
                      <button 
                        onClick={() => handleMarkRead(alert.id)}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors border border-transparent hover:border-blue-100"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Unread dot indicator for desktop */}
                {!alert.is_read && (
                  <div className="hidden sm:flex items-center justify-center shrink-0 pr-2">
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-sm ring-4 ring-blue-50" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
        active 
          ? "border-blue-600 text-blue-600" 
          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
      )}
    >
      {label}
    </button>
  );
}
