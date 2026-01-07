import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Combo, ComboItem } from '../types';
import { showToast } from '../utils/toast';
import Modal from '../components/Modal';

const ITEMS_PER_PAGE = 10;

export default function Combos() {
  const { state, dispatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [comboName, setComboName] = useState('');
  const [comboDescription, setComboDescription] = useState('');
  const [comboItems, setComboItems] = useState<ComboItem[]>([]);

  // Available products for adding to combo
  const availableProducts = useMemo(() => {
    return state.products.filter(p => p.active);
  }, [state.products]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredCombos = useMemo(() => {
    return state.combos.filter(c => {
      const matchesSearch = searchQuery === '' ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSearch;
    });
  }, [state.combos, searchQuery]);

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredCombos.length / ITEMS_PER_PAGE);
  const paginatedCombos = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCombos.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCombos, currentPage]);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPaginationGroup = () => {
    let start = Math.floor((currentPage - 1) / 5) * 5;
    return new Array(Math.min(5, totalPages - start)).fill(0).map((_, idx) => start + idx + 1);
  };

  const handleOpenModal = (combo?: Combo) => {
    if (combo) {
      setEditingCombo(combo);
      setComboName(combo.name);
      setComboDescription(combo.description || '');
      setComboItems(combo.items);
    } else {
      setEditingCombo(null);
      setComboName('');
      setComboDescription('');
      setComboItems([]);
    }
    setShowModal(true);
  };

  const handleSaveCombo = () => {
    if (!comboName.trim() || comboItems.length === 0) {
      showToast('Combo name and at least one item are required', 'error');
      return;
    }

    if (editingCombo) {
      dispatch({
        type: 'UPDATE_COMBO',
        payload: {
          ...editingCombo,
          name: comboName.trim(),
          description: comboDescription.trim() || undefined,
          items: comboItems,
          updatedAt: new Date().toISOString(),
        },
      });
      showToast('Combo updated', 'success');
    } else {
      const newCombo: Combo = {
        id: Date.now().toString(),
        name: comboName.trim(),
        description: comboDescription.trim() || undefined,
        items: comboItems,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_COMBO', payload: newCombo });
      showToast('Combo created', 'success');
    }
    setShowModal(false);
  };

  const handleToggleActive = (combo: Combo) => {
    dispatch({
      type: 'UPDATE_COMBO',
      payload: { ...combo, active: !combo.active, updatedAt: new Date().toISOString() },
    });
    showToast(`Combo ${combo.active ? 'deactivated' : 'activated'}`, 'success');
  };

  const handleAddItemToCombo = (productId: string) => {
    const existingItem = comboItems.find(item => item.productId === productId);
    if (existingItem) {
      setComboItems(comboItems.map(item =>
        item.productId === productId ? { ...item, qty: item.qty + 1 } : item
      ));
    } else {
      setComboItems([...comboItems, { productId, qty: 1 }]);
    }
  };

  const handleUpdateComboItemQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setComboItems(comboItems.filter(item => item.productId !== productId));
    } else {
      setComboItems(comboItems.map(item =>
        item.productId === productId ? { ...item, qty } : item
      ));
    }
  };

  const getProductDetails = (productId: string) => {
    return state.products.find(p => p.id === productId);
  };

  const calculateComboPrice = (combo: Combo) => {
    return combo.items.reduce((sum, item) => {
      const product = getProductDetails(item.productId);
      return sum + (product ? product.price * item.qty : 0);
    }, 0);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 lg:mb-6 gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
            Combo Management
          </h1>
          <p className="text-sm lg:text-base text-gray-500">{filteredCombos.length} combos found</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 lg:px-6 lg:py-3 text-sm lg:text-base bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center whitespace-nowrap h-12"
        >
          <svg className="w-4 h-4 lg:w-5 lg:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Combo
        </button>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search combos by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 hover:border-indigo-300 bg-gray-50 focus:bg-white text-base"
          />
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft overflow-hidden border border-gray-200/50">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedCombos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-lg font-medium">No combos found</p>
                      <p className="text-sm">Try adjusting your search criteria or add a new combo</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCombos.map((combo, index) => (
                  <tr
                    key={combo.id}
                    className={`hover:bg-indigo-50/50 transition-colors duration-150 animate-slide-up`}
                    style={{ animationDelay: `${index * 0.03}s`, animationFillMode: 'both' }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-base font-semibold text-gray-900">
                      {combo.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600">
                      {combo.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-base text-gray-600">
                      <ul className="list-disc list-inside">
                        {combo.items.map(item => {
                          const product = getProductDetails(item.productId);
                          return <li key={item.productId}>{item.qty} x {product?.name || 'Unknown Product'}</li>;
                        })}
                      </ul>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base font-semibold text-gray-900">
                      ${calculateComboPrice(combo).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${combo.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {combo.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base font-medium space-x-3">
                      <button
                        onClick={() => handleOpenModal(combo)}
                        className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all duration-200 h-10"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(combo)}
                        className="text-gray-600 hover:text-gray-800 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-all duration-200 h-10"
                      >
                        {combo.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Controls */}
        {filteredCombos.length > ITEMS_PER_PAGE && (
          <div className="flex justify-between items-center p-4 border-t border-gray-200">
            <span className="text-sm text-gray-700">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredCombos.length)} of {filteredCombos.length} combos
            </span>
            <div className="flex space-x-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed h-10"
              >
                Previous
              </button>
              {getPaginationGroup().map((item, index) => (
                <button
                  key={index}
                  onClick={() => handlePageChange(item)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg h-10 ${
                    currentPage === item
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {item}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed h-10"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCombo ? 'Edit Combo' : 'Add Combo'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-base font-medium mb-1">Combo Name *</label>
            <input
              type="text"
              value={comboName}
              onChange={(e) => setComboName(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl text-base"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-1">Description (Optional)</label>
            <textarea
              value={comboDescription}
              onChange={(e) => setComboDescription(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl text-base"
              rows={3}
            />
          </div>
          <div>
            <h3 className="text-base font-medium mb-2">Items in Combo *</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto border p-3 rounded-lg bg-gray-50 mb-4">
              {comboItems.length === 0 ? (
                <p className="text-gray-500">No items added to this combo.</p>
              ) : (
                comboItems.map(item => {
                  const product = getProductDetails(item.productId);
                  return (
                    <div key={item.productId} className="flex items-center justify-between bg-white p-2 rounded-lg shadow-sm">
                      <span className="font-medium text-gray-800">{product?.name || 'Unknown Product'}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateComboItemQty(item.productId, item.qty - 1)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700 font-bold"
                        >-</button>
                        <span className="font-semibold text-gray-900">{item.qty}</span>
                        <button
                          onClick={() => handleUpdateComboItemQty(item.productId, item.qty + 1)}
                          className="w-8 h-8 flex items-center justify-center bg-indigo-100 hover:bg-indigo-200 rounded-md text-indigo-700 font-bold"
                        >+</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <h3 className="text-base font-medium mb-2">Add Products to Combo:</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
              {availableProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => handleAddItemToCombo(product.id)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:border-indigo-500 transition-all duration-200"
                >
                  {product.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 bg-gray-200 rounded-xl hover:bg-gray-300 text-base h-12"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCombo}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-base h-12"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
