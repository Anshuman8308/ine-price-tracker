import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle, Info, TrendingDown, Package } from 'lucide-react';
import { cn } from '../utils/cn';

export type ToastType = 'success' | 'error' | 'info' | 'price_drop' | 'stock_change';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 pointer-events-none w-full max-w-sm">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  React.useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        onRemove(toast.id);
      }, toast.duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [toast, onRemove]);

  const Icon = {
    success: CheckCircle2,
    error: AlertTriangle,
    info: Info,
    price_drop: TrendingDown,
    stock_change: Package,
  }[toast.type];

  const styleClasses = {
    success: 'bg-white border-green-200 shadow-lg shadow-green-100',
    error: 'bg-white border-red-200 shadow-lg shadow-red-100',
    info: 'bg-white border-blue-200 shadow-lg shadow-blue-100',
    price_drop: 'bg-white border-green-200 shadow-lg shadow-green-100',
    stock_change: 'bg-white border-blue-200 shadow-lg shadow-blue-100',
  }[toast.type];

  const iconClasses = {
    success: 'text-green-500 bg-green-50',
    error: 'text-red-500 bg-red-50',
    info: 'text-blue-500 bg-blue-50',
    price_drop: 'text-green-600 bg-green-100',
    stock_change: 'text-blue-600 bg-blue-100',
  }[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={cn(
        'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border',
        styleClasses
      )}
    >
      <div className={cn('p-2 rounded-lg shrink-0 mt-0.5', iconClasses)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <h4 className="text-sm font-semibold text-slate-800">{toast.title}</h4>
        {toast.message && (
          <p className="text-sm text-slate-600 mt-1 leading-snug">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
