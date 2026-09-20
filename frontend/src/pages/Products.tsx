import { useState, useEffect, useCallback } from 'react';
import { searchProducts, trackProduct } from '../services/api';
import { Search, Plus, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { cn } from '../utils/cn';

const ITEMS_PER_PAGE = 24;

export default function Products() {
  const [query, setQuery] = useState('');
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [trackingId, setTrackingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { addToast } = useToast();

  const handleSearch = useCallback(async (q: string) => {
    setLoading(true);
    setCurrentPage(1); // Reset pagination on new search
    try {
      const data = await searchProducts(q);
      if (data.success) {
        setAllProducts(data.data.products || []);
      }
    } catch (error) {
      console.error('Failed to search products', error);
      addToast({
        type: 'error',
        title: 'Search Failed',
        message: 'Unable to fetch products from the catalog.'
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    // Initial fetch of empty search (shows recent/all products up to backend limit)
    handleSearch('');
  }, [handleSearch]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleTrack = async (product: any) => {
    setTrackingId(product.id);
    try {
      await trackProduct(product.id);
      // Optimistically update the UI to show it's tracked
      setAllProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_tracked: true } : p));
      addToast({
        type: 'success',
        title: 'Tracking Started',
        message: `${product.name} will now be monitored automatically.`
      });
    } catch (error) {
      console.error('Failed to track product', error);
      addToast({
        type: 'error',
        title: 'Tracking Failed',
        message: 'Could not track the selected product.'
      });
    } finally {
      setTrackingId(null);
    }
  };

  // Client-side pagination
  const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = allProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2 mb-8">
        <h2 className="text-2xl font-bold font-outfit text-slate-900">Product Catalog</h2>
        <p className="text-slate-500">Search the mock store catalog to track new products.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-shadow hover:shadow-md">
        <form onSubmit={onSearchSubmit} className="flex flex-col sm:flex-row gap-4 max-w-3xl">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl bg-slate-50 hover:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-700"
              placeholder="Search by product name or brand..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 border border-transparent font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center min-w-[120px]"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {allProducts.length === 0 && !loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No products found</h3>
          <p className="text-slate-500">Try adjusting your search query.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedProducts.map((product) => {
              const isTracked = product.is_tracked;
              const isTracking = trackingId === product.id;
              
              return (
                <div key={product.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col group">
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg w-fit group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        {product.category || 'Product'}
                      </span>
                    </div>
                    
                    <h3 className="font-semibold text-slate-800 line-clamp-2 mb-2 flex-1 group-hover:text-blue-600 transition-colors leading-tight">
                      {product.name}
                    </h3>
                    
                    <div className="flex flex-col gap-1 mb-5">
                      <p className="text-xs text-slate-500 font-semibold">{product.brand || 'Unknown Brand'}</p>
                      <p className="text-[10px] text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded w-fit border border-slate-100">SKU: {product.sku}</p>
                    </div>
                    
                    <button
                      onClick={() => handleTrack(product)}
                      disabled={isTracked || isTracking}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
                        isTracked 
                          ? "bg-green-50 text-green-700 border border-green-200 cursor-default" 
                          : "bg-slate-900 text-white hover:bg-blue-600 shadow-sm hover:shadow-md"
                      )}
                    >
                      {isTracked ? (
                        <>
                          <Check className="w-4 h-4" />
                          Tracked
                        </>
                      ) : isTracking ? (
                        'Tracking...'
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Track Price
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-6 px-2">
              <span className="text-sm text-slate-500 font-medium">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, allProducts.length)} of {allProducts.length} results
              </span>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNumber = i + 1;
                    // Show small window around current page
                    if (pageNumber === 1 || pageNumber === totalPages || (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)) {
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => setCurrentPage(pageNumber)}
                          className={cn(
                            "w-9 h-9 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center",
                            currentPage === pageNumber
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          {pageNumber}
                        </button>
                      );
                    } else if (pageNumber === currentPage - 2 || pageNumber === currentPage + 2) {
                      return <span key={pageNumber} className="text-slate-400">...</span>;
                    }
                    return null;
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
