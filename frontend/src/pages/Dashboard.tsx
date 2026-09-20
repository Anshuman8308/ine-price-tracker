import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTrackedProducts, triggerRefresh, untrackProduct, getAlerts } from '../services/api';
import { RefreshCw, TrendingDown, Clock, Search, ExternalLink, AlertTriangle, CheckCircle2, Package, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '../contexts/ToastContext';
import { cn } from '../utils/cn';

export default function Dashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const fetchDashboardData = useCallback(async (isPolling = false) => {
    try {
      const [productsData, alertsData] = await Promise.all([
        getTrackedProducts(),
        !isPolling || Math.random() > 0.5 ? getAlerts() : Promise.resolve(null)
      ]);

      if (productsData.success) {
        setProducts(productsData.data.trackedProducts);
        // FIX: Update stats unconditionally so dashboard counters synchronize instantly after scrape
        setStats(productsData.data.stats);
      }

      if (alertsData?.success) {
        const displayableAlerts = alertsData.data.alerts.filter((a: any) => a.alert_type !== 'STRUCTURE_CHANGE');
        setAlerts(displayableAlerts.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Polling logic: Poll every 3 seconds if any product is currently scraping
  useEffect(() => {
    const isAnyScraping = products.some(p => p.is_scraping);
    if (!isAnyScraping) return;

    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [products, fetchDashboardData]);

  const handleRefresh = async (productId: number) => {
    try {
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_scraping: true } : p));
      await triggerRefresh(productId);
    } catch (error) {
      console.error(error);
      addToast({
        type: 'error',
        title: 'Scrape Failed to Start',
        message: 'Could not trigger a manual scrape at this time.'
      });
      fetchDashboardData(); // revert
    }
  };

  const handleUntrack = async (productId: number) => {
    try {
      await untrackProduct(productId);
      fetchDashboardData();
      addToast({
        type: 'success',
        title: 'Product Untracked',
        message: 'The product has been removed from your tracking list.'
      });
    } catch (error) {
      console.error(error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to untrack product.'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-slate-500 font-medium animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Overview Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-outfit text-slate-800">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="Tracked Products" 
            value={stats?.active?.toString() || products?.length?.toString() || "0"} 
            icon={<Search className="w-5 h-5 text-blue-500" />}
            trend="Total active tracking"
          />
          <StatCard 
            title="Price Drops" 
            value={stats?.active_alerts?.toString() || "0"} 
            icon={<TrendingDown className="w-5 h-5 text-green-500" />}
            trend="Active unread alerts"
          />
          <StatCard 
            title="Out of Stock" 
            value={stats?.out_of_stock?.toString() || "0"} 
            icon={<Clock className="w-5 h-5 text-amber-500" />}
            trend="Products currently unavailable"
          />
        </div>
      </section>

      {/* Tracked Products Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-outfit text-slate-800">Tracked Products</h2>
        </div>

        {(!products || products.length === 0) ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No tracked products yet</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-6">
              Search for products in the catalog to start tracking their prices and receive alerts when they drop.
            </p>
            <button 
              onClick={() => navigate('/products')}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-md shadow-blue-500/20">
              Browse Catalog
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {products.map((product) => {
              const isScraping = product.is_scraping;
              const hasError = !isScraping && product.last_scrape_status === 'FAILED';
              
              return (
                <div key={product.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group relative flex flex-col">
                  {/* Progress Bar for Scraping */}
                  {isScraping && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 overflow-hidden">
                      <div className="h-full bg-blue-500 animate-pulse w-full"></div>
                    </div>
                  )}
                  
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg w-fit transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                        {product.category || 'Product'}
                      </span>
                      <a href={product.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    
                    <h3 className="font-semibold text-slate-800 line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors leading-tight">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">{product.brand || 'Unknown Brand'}</p>
                    
                    <div className="mt-auto">
                      {/* Price and Stock Row */}
                      <div className="flex items-end justify-between mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100/60 shadow-inner">
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-wider">Valid Price</p>
                          <span className="text-2xl font-bold text-slate-900 font-outfit tracking-tight">
                            {product.current_price ? `₹${product.current_price.toLocaleString()}` : <span className="text-slate-400 text-lg">No price yet</span>}
                          </span>
                        </div>
                        <div className="text-right">
                          {product.stock_status === 'IN_STOCK' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full border border-green-200 shadow-sm">
                              <CheckCircle2 className="w-3.5 h-3.5" /> In Stock
                            </span>
                          ) : product.stock_status === 'OUT_OF_STOCK' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 px-3 py-1 rounded-full border border-red-200 shadow-sm">
                              Out of Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                              Unknown
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Status Info Row */}
                      <div className="flex items-center justify-between text-xs mb-5 px-1">
                        <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {product.last_successful_scrape_at 
                              ? `Updated ${formatDistanceToNow(new Date(product.last_successful_scrape_at), { addSuffix: true })}` 
                              : 'Never scraped'}
                          </span>
                        </div>
                        
                        {hasError && (
                          <div className="flex items-center gap-1.5 text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded shadow-sm border border-red-100" title={product.last_scrape_error}>
                            <AlertTriangle className="w-3 h-3" />
                            <span>FAILED</span>
                          </div>
                        )}
                      </div>
    
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleRefresh(product.id)}
                          disabled={isScraping}
                          className={cn(
                            "flex-1 flex justify-center items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm",
                            isScraping 
                              ? 'bg-blue-50 text-blue-400 cursor-not-allowed border border-blue-100' 
                              : hasError
                                ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:shadow-md'
                                : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 hover:shadow-md'
                          )}
                        >
                          <RefreshCw className={cn("w-4 h-4", isScraping && "animate-spin text-blue-500")} />
                          {isScraping ? 'Scraping...' : hasError ? 'Try Again' : 'Scrape Now'}
                        </button>
                        <button 
                          onClick={() => handleUntrack(product.id)}
                          disabled={isScraping}
                          className="flex justify-center items-center px-4 py-2.5 bg-white border border-slate-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-xl text-sm font-medium transition-colors shadow-sm"
                          title="Untrack Product"
                        >
                          Untrack
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Alerts Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-outfit text-slate-800">Recent Alerts</h2>
        </div>
        
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent alerts.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {alerts.map(alert => {
                const isPriceDrop = alert.alert_type === 'PRICE_DROP';
                return (
                  <div key={alert.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer" onClick={() => navigate('/alerts')}>
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-sm",
                        isPriceDrop ? "bg-green-50 border-green-100 text-green-600" : "bg-blue-50 border-blue-100 text-blue-600"
                      )}>
                        {isPriceDrop ? <TrendingDown className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 line-clamp-1">
                          {isPriceDrop ? 'Price Drop' : 'Stock Update'}
                        </p>
                        <p className="text-sm text-slate-600 mt-0.5">{alert.product_name || 'Product'} - {alert.message}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-400 tracking-wider">
                      {alert.triggered_at ? formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true }) : 'recently'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md hover:border-slate-300 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">{title}</h3>
        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl group-hover:scale-110 transition-transform duration-300">{icon}</div>
      </div>
      <div className="mb-1">
        <span className="text-3xl font-bold text-slate-900 font-outfit tracking-tight">{value}</span>
      </div>
      <p className="text-xs text-slate-500 font-medium">{trend}</p>
    </div>
  );
}
