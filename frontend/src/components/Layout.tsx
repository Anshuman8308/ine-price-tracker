import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Activity, LayoutDashboard, Settings, Bell, Box, CheckCircle2, TrendingDown, Package, Inbox, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getAlerts, markAlertRead } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { AnimatePresence, motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

export default function Layout() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load last seen alert ID to prevent duplicate toasts across reloads
  const [lastSeenAlertId, setLastSeenAlertId] = useState<number>(() => {
    return parseInt(localStorage.getItem('lastSeenAlertId') || '0', 10);
  });

  const fetchAlerts = async (isPolling = false) => {
    try {
      const { data, success } = await getAlerts();
      if (success && data?.alerts) {
        setAlerts(data.alerts);

        if (data.alerts.length > 0) {
          const maxId = Math.max(...data.alerts.map((a: any) => a.id));
          
          if (isPolling && maxId > lastSeenAlertId) {
            // Find all new alerts
            const newAlerts = data.alerts.filter((a: any) => a.id > lastSeenAlertId);
            
            // Only toast if it's a manageable number to avoid spam
            if (newAlerts.length <= 3) {
              newAlerts.forEach((alert: any) => {
                const isPriceDrop = alert.alert_type === 'PRICE_DROP';
                const isOutOfStock = alert.alert_type === 'OUT_OF_STOCK' || alert.new_value === 'OUT_OF_STOCK';
                addToast({
                  type: isPriceDrop ? 'price_drop' : isOutOfStock ? 'error' : 'stock_change',
                  title: isPriceDrop ? 'Price Drop Detected' : isOutOfStock ? 'Product Out of Stock' : 'Stock Update',
                  message: `${alert.product_name || 'Product'} - ${alert.message}`,
                  duration: 6000
                });
              });
            } else if (newAlerts.length > 3) {
               addToast({
                 type: 'info',
                 title: 'New Alerts',
                 message: `You have ${newAlerts.length} new notifications.`,
                 duration: 5000
               });
            }
            
            setLastSeenAlertId(maxId);
            localStorage.setItem('lastSeenAlertId', maxId.toString());
          } else if (!isPolling && maxId > lastSeenAlertId) {
             // Just update local storage on initial load without toasting historical alerts
             setLastSeenAlertId(maxId);
             localStorage.setItem('lastSeenAlertId', maxId.toString());
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch alerts', error);
    }
  };

  useEffect(() => {
    fetchAlerts(false);
    // Poll every 5 seconds for new alerts
    const interval = setInterval(() => fetchAlerts(true), 5000);
    return () => clearInterval(interval);
  }, [lastSeenAlertId]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayableAlerts = alerts.filter(a => a.alert_type !== 'STRUCTURE_CHANGE');
  const unreadAlerts = displayableAlerts.filter(a => !a.is_read);
  const recentAlerts = displayableAlerts.slice(0, 5);

  const handleMarkRead = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await markAlertRead(id);
      setAlerts(alerts.map(a => a.id === id ? { ...a, is_read: true } : a));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 fixed h-full z-20 flex flex-col shadow-lg">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-2 text-blue-500">
            <Activity className="w-6 h-6" />
            <span className="font-outfit font-bold text-xl text-white tracking-tight">PriceTracker</span>
          </div>
        </div>
        
        <nav className="flex-1 py-6 px-4 flex flex-col gap-2">
          <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Overview" />
          <NavItem to="/products" icon={<Box size={20} />} label="Catalog" />
          <NavItem to="/alerts" icon={<Bell size={20} />} label="Alerts" badge={unreadAlerts.length} />
          <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" />
          <NavItem to="/about" icon={<Info size={20} />} label="About" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 min-h-screen flex flex-col relative">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10 flex items-center justify-between px-8">
          <h1 className="font-outfit font-semibold text-lg text-slate-800">Dashboard</h1>
          
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                className={cn(
                  "relative p-2 rounded-xl transition-all duration-200",
                  showDropdown ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Bell className="w-5 h-5" />
                {unreadAlerts.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                )}
              </button>

              <AnimatePresence>
                {showDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col z-50"
                  >
                    <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <span className="font-semibold text-slate-800 text-sm">Notifications</span>
                      {unreadAlerts.length > 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                          {unreadAlerts.length} new
                        </span>
                      )}
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto">
                      {recentAlerts.length === 0 ? (
                        <div className="px-4 py-8 flex flex-col items-center justify-center text-slate-400">
                          <Inbox className="w-8 h-8 mb-2 opacity-50" />
                          <p className="text-sm font-medium">All caught up!</p>
                        </div>
                      ) : (
                        recentAlerts.map(alert => {
                          const isPriceDrop = alert.alert_type === 'PRICE_DROP';
                          const isOutOfStock = alert.alert_type === 'OUT_OF_STOCK' || alert.new_value === 'OUT_OF_STOCK';
                          return (
                            <div 
                              key={alert.id}
                              onClick={() => {
                                setShowDropdown(false);
                                navigate('/alerts');
                              }}
                              className={cn(
                                "px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 flex gap-3",
                                !alert.is_read ? "bg-blue-50/30" : ""
                              )}
                            >
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                                isPriceDrop ? "bg-green-100 text-green-600" : isOutOfStock ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                              )}>
                                {isPriceDrop ? <TrendingDown className="w-4 h-4" /> : isOutOfStock ? <AlertTriangle className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-sm font-medium line-clamp-1",
                                  !alert.is_read ? "text-slate-900" : "text-slate-600"
                                )}>
                                  {alert.product_name || 'Product'}
                                </p>
                                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{alert.message}</p>
                                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                  {alert.triggered_at ? formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true }) : 'recently'}
                                </p>
                              </div>
                              {!alert.is_read && (
                                <button 
                                  onClick={(e) => handleMarkRead(e, alert.id)}
                                  className="shrink-0 text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Mark as read"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <button 
                      onClick={() => {
                        setShowDropdown(false);
                        navigate('/alerts');
                      }}
                      className="px-4 py-2.5 bg-slate-50 text-center text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border-t border-slate-100"
                    >
                      View all alerts &rarr;
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div 
              onClick={() => navigate('/about')}
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-sm border border-white/20 cursor-pointer"
            >
              A
            </div>
          </div>
        </header>
        
        <div className="p-8 max-w-[1400px] w-full mx-auto flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, icon, label, badge }: { to: string; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 font-semibold group",
        isActive 
          ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 translate-x-1" 
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
    >
      {({ isActive }) => (
        <>
          <div className="flex items-center gap-3">
            {icon}
            {label}
          </div>
          {badge !== undefined && badge > 0 && (
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-bold transition-colors",
              isActive ? "bg-white/20 text-white" : "bg-red-500 text-white"
            )}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
