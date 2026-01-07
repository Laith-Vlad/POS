import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { showToast } from '../utils/toast';
import Modal from '../components/Modal';

const ITEMS_PER_PAGE = 10;

export default function Inventory() {
  const { state, dispatch } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  const categories = Array.from(new Set(state.products.map(p => p.category)));

  // Reset to page 1 when search, category, or low stock filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, lowStockOnly]);

  const filteredProducts = useMemo(() => {
    return state.products.filter(p => {
      const matchesSearch = searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const isLowStock = p.stockQty <= state.settings.lowStockThreshold;
      return matchesSearch && matchesCategory && (!lowStockOnly || isLowStock);
    });
  }, [state.products, searchQuery, selectedCategory, lowStockOnly, state.settings.lowStockThreshold]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleAdjust = (product: Product) => {
    setSelectedProduct(product);
    setAdjustQty('');
    setAdjustNote('');
    setShowAdjustModal(true);
  };

  const handleSaveAdjustment = () => {
    if (!selectedProduct) return;

    const qtyDelta = parseFloat(adjustQty);
    if (isNaN(qtyDelta) || qtyDelta === 0) {
      showToast('Invalid quantity', 'error');
      return;
    }

    const newQty = selectedProduct.stockQty + qtyDelta;
    if (newQty < 0) {
      showToast('Stock cannot be negative', 'error');
      return;
    }

    dispatch({
      type: 'UPDATE_PRODUCT',
      payload: { ...selectedProduct, stockQty: newQty },
    });

    dispatch({
      type: 'ADD_INVENTORY_EVENT',
      payload: {
        id: Date.now().toString(),
        at: new Date().toISOString(),
        userId: state.currentUser!.id,
        productId: selectedProduct.id,
        type: 'MANUAL_ADJUST',
        qtyDelta,
        note: adjustNote || 'Manual adjustment',
      },
    });

    dispatch({
      type: 'ADD_AUDIT_LOG',
      payload: {
        id: Date.now().toString(),
        at: new Date().toISOString(),
        userId: state.currentUser!.id,
        action: 'INVENTORY_ADJUST',
        details: `Product ${selectedProduct.name}: ${qtyDelta > 0 ? '+' : ''}${qtyDelta} (${adjustNote || 'Manual adjustment'})`,
      },
    });

    showToast('Inventory adjusted', 'success');
    setShowAdjustModal(false);
  };

  const handleShowHistory = (product: Product) => {
    setHistoryProduct(product);
    setShowHistory(true);
  };

  const productEvents = historyProduct
    ? state.inventoryEvents.filter(e => e.productId === historyProduct.id)
    : [];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
          Inventory Management
        </h1>
        <p className="text-sm text-gray-500">Track and adjust product stock levels</p>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-white focus:bg-white font-medium"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-white focus:bg-white font-semibold cursor-pointer"
          >
            <option value="All">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center px-4 py-3 bg-white border-2 border-gray-300 rounded-xl hover:border-indigo-300 transition-all duration-200 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="mr-3 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
          />
          <span className="text-sm lg:text-base font-semibold text-gray-800">Low Stock Only (≤ {state.settings.lowStockThreshold})</span>
        </label>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft overflow-hidden border border-gray-200/50">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax Rate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Qty</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <svg className="w-12 h-12 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-lg font-medium">No products found</p>
                    <p className="text-sm">Try adjusting your search or filter criteria</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedProducts.map((product, index) => {
              const isLowStock = product.stockQty <= state.settings.lowStockThreshold;
              return (
                <tr 
                  key={product.id}
                  className="hover:bg-indigo-50/50 transition-colors duration-150 animate-slide-up"
                  style={{ animationDelay: `${index * 0.03}s`, animationFillMode: 'both' }}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{product.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ${product.price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                    {(product.taxRate * 100).toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">{product.stockQty}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      isLowStock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {isLowStock ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <button
                      onClick={() => handleAdjust(product)}
                      className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all duration-200"
                    >
                      Adjust
                    </button>
                    <button
                      onClick={() => handleShowHistory(product)}
                      className="text-gray-600 hover:text-gray-800 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-all duration-200"
                    >
                      History
                    </button>
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft p-4 border border-gray-200/50">
          <div className="text-sm text-gray-700 font-medium">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} products
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-base font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                // Show first page, last page, current page, and pages around current
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-4 py-2 text-base font-semibold rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                        currentPage === page
                          ? 'bg-indigo-600 text-white border-2 border-indigo-700'
                          : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  page === currentPage - 2 ||
                  page === currentPage + 2
                ) {
                  return (
                    <span key={page} className="px-2 text-gray-500">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-base font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="Adjust Inventory"
        size="sm"
      >
        {selectedProduct && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Product: <strong>{selectedProduct.name}</strong></p>
              <p className="text-sm text-gray-600">Current Stock: <strong>{selectedProduct.stockQty}</strong></p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Quantity Adjustment (use + for increase, - for decrease)
              </label>
              <input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="e.g., +10 or -5"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Note</label>
              <input
                type="text"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="Optional note"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAdjustModal(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdjustment}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        title={`Inventory History - ${historyProduct?.name}`}
        size="lg"
      >
        <div className="space-y-2">
          {productEvents.length === 0 ? (
            <p className="text-gray-500">No history available</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty Delta</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productEvents.map(event => (
                  <tr key={event.id}>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {new Date(event.at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">{event.type}</td>
                    <td className={`px-4 py-2 text-sm font-medium ${
                      event.qtyDelta > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {event.qtyDelta > 0 ? '+' : ''}{event.qtyDelta}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">{event.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </div>
  );
}
