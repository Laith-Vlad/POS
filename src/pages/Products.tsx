import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { showToast } from '../utils/toast';
import Modal from '../components/Modal';

const ITEMS_PER_PAGE = 10;

export default function Products() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: '',
    price: '',
    taxRate: '',
    cost: '',
    stockQty: '',
    shortcutKey: '',
  });

  const categories = Array.from(new Set(state.products.map(p => p.category)));

  // Reset to page 1 when search or category filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  const filteredProducts = useMemo(() => {
    return state.products.filter(p => {
      const matchesSearch = searchQuery === '' || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [state.products, searchQuery, selectedCategory]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        category: product.category,
        price: product.price.toString(),
        taxRate: product.taxRate.toString(),
        cost: product.cost.toString(),
        stockQty: product.stockQty.toString(),
        shortcutKey: product.shortcutKey !== undefined ? product.shortcutKey.toString() : '',
      });
    } else {
      setEditingProduct(null);
      // Find next available shortcut key for new products
      const activeProducts = state.products.filter(p => p.active);
      const usedKeys = new Set(activeProducts.map(p => p.shortcutKey).filter(key => key !== undefined));
      let nextShortcut = '';
      for (let i = 1; i <= 9; i++) {
        if (!usedKeys.has(i)) {
          nextShortcut = i.toString();
          break;
        }
      }
      if (!nextShortcut && !usedKeys.has(0)) {
        nextShortcut = '0';
      }
      
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        category: '',
        price: '',
        taxRate: '',
        cost: '',
        stockQty: '',
        shortcutKey: nextShortcut,
      });
    }
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.sku || !formData.barcode || !formData.category || !formData.shortcutKey) {
      showToast('Please fill all required fields including shortcut key', 'error');
      return;
    }

    const price = parseFloat(formData.price);
    const taxRate = parseFloat(formData.taxRate);
    const cost = parseFloat(formData.cost);
    const stockQty = parseInt(formData.stockQty);
    const shortcutKey = parseInt(formData.shortcutKey);

    if (isNaN(price) || price < 0) {
      showToast('Invalid price', 'error');
      return;
    }
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 1) {
      showToast('Tax rate must be between 0 and 1', 'error');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      showToast('Invalid cost', 'error');
      return;
    }
    if (isNaN(stockQty) || stockQty < 0) {
      showToast('Invalid stock quantity', 'error');
      return;
    }
    if (isNaN(shortcutKey) || shortcutKey < 0 || shortcutKey > 9) {
      showToast('Shortcut key must be a number between 0 and 9', 'error');
      return;
    }

    // Check for duplicate SKU
    if (state.products.some(p => p.sku === formData.sku && p.id !== editingProduct?.id)) {
      showToast('SKU already exists', 'error');
      return;
    }

    // Check for duplicate barcode
    if (state.products.some(p => p.barcode === formData.barcode && p.id !== editingProduct?.id)) {
      showToast('Barcode already exists', 'error');
      return;
    }

    // Check for duplicate shortcut key (only for active products)
    const activeProductsWithSameShortcut = state.products.filter(
      p => p.active && p.shortcutKey === shortcutKey && p.id !== editingProduct?.id
    );
    if (activeProductsWithSameShortcut.length > 0) {
      showToast(`Shortcut key ${shortcutKey} is already assigned to another active product`, 'error');
      return;
    }

    if (editingProduct) {
      dispatch({
        type: 'UPDATE_PRODUCT',
        payload: {
          ...editingProduct,
          name: formData.name,
          sku: formData.sku,
          barcode: formData.barcode,
          category: formData.category,
          price,
          taxRate,
          cost,
          stockQty,
          shortcutKey,
        },
      });
      showToast('Product updated', 'success');
    } else {
      const newProduct: Product = {
        id: Date.now().toString(),
        name: formData.name,
        sku: formData.sku,
        barcode: formData.barcode,
        category: formData.category,
        price,
        taxRate,
        cost,
        stockQty,
        active: true,
        shortcutKey,
      };
      dispatch({ type: 'ADD_PRODUCT', payload: newProduct });
      showToast(`Product created with hotkey Ctrl+${shortcutKey === 0 ? '0' : shortcutKey}`, 'success');
    }
    setShowModal(false);
  };

  const handleToggleActive = (product: Product) => {
    dispatch({
      type: 'UPDATE_PRODUCT',
      payload: { ...product, active: !product.active },
    });
    showToast(`Product ${product.active ? 'deactivated' : 'activated'}`, 'success');
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 lg:mb-6 gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
            Products
          </h1>
          <p className="text-xs lg:text-sm text-gray-500">
            {filteredProducts.filter(p => p.active).length} of {state.products.filter(p => p.active).length} active products
            {filteredProducts.length !== state.products.length && ` (${filteredProducts.length} filtered)`}
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 lg:px-6 lg:py-3 text-sm lg:text-base bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center whitespace-nowrap"
        >
          <svg className="w-4 h-4 lg:w-5 lg:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Product
        </button>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
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

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft overflow-hidden border border-gray-200/50">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Shortcut</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax Rate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedProducts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <svg className="w-12 h-12 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-lg font-medium">No products found</p>
                    <p className="text-sm">Try adjusting your search or filter criteria</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedProducts.map((product, index) => (
              <tr 
                key={product.id} 
                className={`${!product.active ? 'opacity-50' : ''} hover:bg-indigo-50/50 transition-colors duration-150 animate-slide-up`}
                style={{ animationDelay: `${index * 0.03}s`, animationFillMode: 'both' }}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                  {product.shortcutKey !== undefined ? (
                    <span className="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 text-indigo-700 font-bold text-base rounded-lg border-2 border-indigo-300" title={`Press Ctrl+${product.shortcutKey === 0 ? '0' : product.shortcutKey} to add to cart`}>
                      {product.shortcutKey === 0 ? '0' : product.shortcutKey}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
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
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    product.stockQty === 0 
                      ? 'bg-red-100 text-red-700'
                      : product.stockQty < 10
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {product.stockQty}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${product.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {product.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                  <button
                    onClick={() => handleOpenModal(product)}
                    className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all duration-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(product)}
                    className="text-gray-600 hover:text-gray-800 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-all duration-200"
                  >
                    {product.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
              ))
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

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-medium mb-1">SKU *</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-gray-50 focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-1">Barcode *</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-gray-50 focus:bg-white"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-base font-medium mb-1">Category *</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              list="categories"
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-gray-50 focus:bg-white"
              required
            />
            <datalist id="categories">
              {categories.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-medium mb-1">Price *</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-gray-50 focus:bg-white"
                step="0.01"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-1">Tax Rate (0-1) *</label>
              <input
                type="number"
                value={formData.taxRate}
                onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-gray-50 focus:bg-white"
                step="0.01"
                min="0"
                max="1"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-medium mb-1">Cost *</label>
              <input
                type="number"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-gray-50 focus:bg-white"
                step="0.01"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-1">Stock Qty *</label>
              <input
                type="number"
                value={formData.stockQty}
                onChange={(e) => setFormData({ ...formData, stockQty: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-gray-50 focus:bg-white"
                min="0"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-base font-medium mb-1">Shortcut Key (0-9) *</label>
            <input
              type="number"
              value={formData.shortcutKey}
              onChange={(e) => setFormData({ ...formData, shortcutKey: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-gray-50 focus:bg-white"
              min="0"
              max="9"
              required
              placeholder="Enter a number between 0 and 9"
            />
            <p className="text-xs lg:text-sm text-gray-500 mt-1">
              This key will be used with <strong>Ctrl+{formData.shortcutKey || 'X'}</strong> to quickly add this product to cart in POS
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowModal(false)}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-all duration-200 text-base min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all duration-200 text-base min-h-[44px]"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
