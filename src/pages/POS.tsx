import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { CartItem, Product, Sale, Combo } from '../types';
import { showToast } from '../utils/toast';
import { generateReceiptNumber } from '../utils/dummyData';
import Modal from '../components/Modal';
import PINModal from '../components/PINModal';
import { saveSession } from '../utils/storage';

export default function POS() {
  const { state, dispatch } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCombos, setShowCombos] = useState(false);
  const [showCreateComboModal, setShowCreateComboModal] = useState(false);
  const [comboName, setComboName] = useState('');
  const [comboDescription, setComboDescription] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [startingCash, setStartingCash] = useState('');
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [actualCash, setActualCash] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [userDismissedShiftModal, setUserDismissedShiftModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const categories = ['All', ...Array.from(new Set(state.products.map(p => p.category)))];

  useEffect(() => {
    if (!state.currentShift && state.currentUser && !userDismissedShiftModal) {
      setShowOpenShift(true);
    }
  }, [state.currentShift, state.currentUser, userDismissedShiftModal]);

  const handleCheckout = () => {
    if (cart.length === 0) {
      showToast('Cart is empty', 'error');
      return;
    }
    const totals = calculateCartTotals();
    const discountPercentage = totals.discountTotal / (totals.subTotal + totals.discountTotal);
    if (discountPercentage > 0.2 && state.currentUser?.role !== 'Manager') {
      showToast('Discount exceeds 20%. Manager approval required.', 'error');
      return;
    }
    setShowCheckout(true);
  };

  const handleAddToCart = (product: Product) => {
    if (product.stockQty === 0) {
      showToast('Product out of stock', 'error');
      return;
    }
    const existingItem = cart.find(item => item.productId === product.id);
    if (existingItem) {
      if (existingItem.qty >= product.stockQty) {
        showToast('Insufficient stock', 'error');
        return;
      }
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, qty: item.qty + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        qty: 1,
        unitPrice: product.price,
        discountAmount: 0,
      }]);
    }
    setSearchQuery('');
    showToast(`${product.name} added to cart`, 'success');
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in an input field or modal is open
      const isInputFocused = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const isModalOpen = showCheckout || showReceipt || showOpenShift || showCloseShift;
      
      if (isInputFocused || isModalOpen) {
        return;
      }

      if (e.key === '/' && e.target === document.body) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.ctrlKey && e.key === 'Enter' && cart.length > 0 && !showCheckout) {
        e.preventDefault();
        handleCheckout();
        return;
      }

      // Handle product shortcuts: Ctrl + number (1-9, 0)
      // IMPORTANT: Prevent default FIRST to stop browser tab switching
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const key = e.key;
        // Check if key is a number (0-9)
        if (key >= '0' && key <= '9') {
          // Prevent browser tab switching FIRST
          e.preventDefault();
          e.stopPropagation();
          
          const shortcutNumber = key === '0' ? 0 : parseInt(key);
          const product = state.products.find(p => p.active && p.shortcutKey === shortcutNumber);
          
          if (product) {
            // Always add to cart, even if not in current filtered view (shortcuts work globally)
            handleAddToCart(product);
            return;
          } else {
            // Product not found for this shortcut - show message
            showToast(`No product assigned to shortcut Ctrl+${shortcutNumber === 0 ? '0' : shortcutNumber}`, 'info');
          }
        }
      }
    };
    
    // Use capture phase to intercept before browser handles it
    window.addEventListener('keydown', handleKeyPress, true);
    return () => window.removeEventListener('keydown', handleKeyPress, true);
  }, [cart, showCheckout, showReceipt, showOpenShift, showCloseShift, state.products]);

  const filteredProducts = state.products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory && p.active;
  });

  const filteredCombos = state.combos.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch && c.active;
  });

  const handleAddComboToCart = (combo: Combo) => {
    // First, validate all items have stock before adding anything
    for (const comboItem of combo.items) {
      const product = state.products.find(p => p.id === comboItem.productId);
      if (!product) {
        showToast(`Product not found in combo "${combo.name}"`, 'error');
        return;
      }
      
      if (!product.active) {
        showToast(`${product.name} is no longer available`, 'error');
        return;
      }

      const existingCartItem = cart.find(cartItem => cartItem.productId === comboItem.productId);
      const currentQty = existingCartItem ? existingCartItem.qty : 0;
      const newQty = currentQty + comboItem.qty;

      if (product.stockQty < newQty) {
        showToast(`Insufficient stock for ${product.name}. Available: ${product.stockQty}, Requested: ${newQty}`, 'error');
        return;
      }
    }

    // All validations passed, now add all items at once
    const updatedCart = [...cart];
    
    combo.items.forEach(comboItem => {
      const product = state.products.find(p => p.id === comboItem.productId)!;
      const existingIndex = updatedCart.findIndex(cartItem => cartItem.productId === comboItem.productId);
      
      if (existingIndex >= 0) {
        // Update existing item quantity
        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          qty: updatedCart[existingIndex].qty + comboItem.qty,
        };
      } else {
        // Add new item to cart
        updatedCart.push({
          productId: comboItem.productId,
          qty: comboItem.qty,
          unitPrice: product.price,
          discountAmount: 0,
        });
      }
    });

    setCart(updatedCart);
    showToast(`Combo "${combo.name}" added to cart`, 'success');
  };

  const handleCreateComboFromCart = () => {
    if (cart.length === 0) {
      showToast('Cart is empty. Add items to create a combo', 'error');
      return;
    }
    setShowCreateComboModal(true);
  };

  const handleSaveCombo = () => {
    if (!comboName.trim()) {
      showToast('Please enter a combo name', 'error');
      return;
    }

    const comboItems = cart.map(item => ({
      productId: item.productId,
      qty: item.qty,
    }));

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
    showToast(`Combo "${newCombo.name}" created successfully`, 'success');
    setShowCreateComboModal(false);
    setComboName('');
    setComboDescription('');
  };

  const calculateComboPrice = (combo: Combo): number => {
    return combo.items.reduce((sum, item) => {
      const product = state.products.find(p => p.id === item.productId);
      return sum + (product ? product.price * item.qty : 0);
    }, 0);
  };

  const calculateCartTotals = () => {
    const subTotal = cart.reduce((sum, item) => {
      return sum + (item.unitPrice * item.qty - item.discountAmount);
    }, 0);
    const discountTotal = cart.reduce((sum, item) => sum + item.discountAmount, 0);
    const taxTotal = state.settings.taxEnabled
      ? cart.reduce((sum, item) => {
          const product = state.products.find(p => p.id === item.productId)!;
          const itemTotal = item.unitPrice * item.qty - item.discountAmount;
          return sum + itemTotal * product.taxRate;
        }, 0)
      : 0;
    const grandTotal = subTotal + taxTotal;
    return { subTotal, discountTotal, taxTotal, grandTotal };
  };

  const handleUpdateCartItem = (productId: string, updates: Partial<CartItem>) => {
    setCart(cart.map(item =>
      item.productId === productId ? { ...item, ...updates } : item
    ));
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const handleVoidCart = () => {
    if (state.currentUser?.role !== 'Manager') {
      setShowVoidModal(true);
      return;
    }
    setCart([]);
    showToast('Cart voided', 'info');
  };

  const handleVoidWithPIN = () => {
    setCart([]);
    setShowVoidModal(false);
    showToast('Cart voided', 'info');
    dispatch({
      type: 'ADD_AUDIT_LOG',
      payload: {
        id: Date.now().toString(),
        at: new Date().toISOString(),
        userId: state.currentUser!.id,
        action: 'VOID_CART',
        details: 'Cart voided by manager',
      },
    });
  };

  const [cashReceivedForReceipt, setCashReceivedForReceipt] = useState('');

  const handleCompleteSale = () => {
    if (!state.currentShift) {
      showToast('No open shift. Please open a shift to process sales.', 'error');
      setUserDismissedShiftModal(false); // Allow modal to show
      setTimeout(() => setShowOpenShift(true), 500);
      return;
    }

    const totals = calculateCartTotals();
    let payments: Sale['payments'] = {};

    if (paymentMethod === 'cash') {
      const received = parseFloat(cashReceived);
      if (received < totals.grandTotal) {
        showToast('Insufficient payment', 'error');
        return;
      }
      payments = { cash: totals.grandTotal };
      setCashReceivedForReceipt(cashReceived); // Store for receipt display
    } else if (paymentMethod === 'card') {
      payments = { card: totals.grandTotal };
      setCashReceivedForReceipt('');
    }

    const sale: Sale = {
      id: Date.now().toString(),
      receiptNo: generateReceiptNumber(),
      createdAt: new Date().toISOString(),
      cashierUserId: state.currentUser!.id,
      items: cart,
      subTotal: Math.round(totals.subTotal * 100) / 100,
      discountTotal: Math.round(totals.discountTotal * 100) / 100,
      taxTotal: Math.round(totals.taxTotal * 100) / 100,
      grandTotal: Math.round(totals.grandTotal * 100) / 100,
      payments,
      status: 'PAID',
    };

    dispatch({ type: 'ADD_SALE', payload: sale });

    cart.forEach(item => {
      dispatch({
        type: 'ADD_INVENTORY_EVENT',
        payload: {
          id: Date.now().toString() + item.productId,
          at: new Date().toISOString(),
          userId: state.currentUser!.id,
          productId: item.productId,
          type: 'SALE',
          qtyDelta: -item.qty,
          note: `Sale ${sale.receiptNo}`,
        },
      });
    });

    setCurrentSale(sale);
    setCart([]);
    setShowCheckout(false);
    setShowReceipt(true);
    // Keep cashReceived for receipt display
    showToast('Sale completed successfully', 'success');
  };

  const handleOpenShift = () => {
    const cash = parseFloat(startingCash);
    if (isNaN(cash) || cash < 0) {
      showToast('Invalid starting cash amount', 'error');
      return;
    }
    const shift = {
      id: Date.now().toString(),
      openedAt: new Date().toISOString(),
      openedBy: state.currentUser!.id,
      startingCash: cash,
      expectedCash: cash,
      status: 'OPEN' as const,
    };
    dispatch({ type: 'OPEN_SHIFT', payload: shift });
    saveSession(state.currentUser!.id, shift.id);
    setShowOpenShift(false);
    setStartingCash('');
    setUserDismissedShiftModal(false);
    showToast('Shift opened', 'success');
  };

  const handleCloseShiftModal = () => {
    setShowOpenShift(false);
    setUserDismissedShiftModal(true);
    showToast('Note: A shift must be open to process sales', 'info');
  };

  const handleCloseShift = () => {
    if (state.currentUser?.role !== 'Manager') {
      showToast('Manager approval required', 'error');
      return;
    }
    setShowCloseShift(true);
  };

  const handleConfirmCloseShift = () => {
    if (!state.currentShift) return;

    const cashSales = state.sales
      .filter(s => s.createdAt >= state.currentShift!.openedAt && s.payments.cash)
      .reduce((sum, s) => sum + (s.payments.cash || 0), 0);
    const cashReturns = state.returns
      .filter(r => r.createdAt >= state.currentShift!.openedAt && r.refundMethod === 'CASH')
      .reduce((sum, r) => sum + r.refundTotal, 0);
    const expectedCash = state.currentShift.startingCash + cashSales - cashReturns;

    const actual = parseFloat(actualCash);
    if (isNaN(actual) || actual < 0) {
      showToast('Invalid cash amount', 'error');
      return;
    }

    const variance = actual - expectedCash;
    const closedShift = {
      ...state.currentShift,
      closedAt: new Date().toISOString(),
      expectedCash,
      actualCash: actual,
      variance,
      status: 'CLOSED' as const,
    };

    dispatch({ type: 'CLOSE_SHIFT', payload: closedShift });
    saveSession(state.currentUser!.id, null);
    dispatch({
      type: 'ADD_AUDIT_LOG',
      payload: {
        id: Date.now().toString(),
        at: new Date().toISOString(),
        userId: state.currentUser!.id,
        action: 'CLOSE_SHIFT',
        details: `Shift closed. Variance: ${variance.toFixed(2)}`,
      },
    });

    setShowCloseShift(false);
    setActualCash('');
    setUserDismissedShiftModal(false); // Reset so modal can show again
    showToast('Shift closed', 'success');
    setTimeout(() => setShowOpenShift(true), 1000);
  };

  const totals = calculateCartTotals();
  const change = paymentMethod === 'cash' && cashReceived
    ? Math.max(0, parseFloat(cashReceived) - totals.grandTotal)
    : 0;

  return (
    <div className="min-h-[calc(100vh-8rem)] animate-fade-in">
      <div className="flex flex-col lg:flex-row h-full gap-4 lg:gap-6">
        {/* Left: Products */}
        <div className="w-full lg:w-2/3 bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft p-4 lg:p-6 flex flex-col border border-gray-200/50">
          <div className="mb-4 lg:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {showCombos ? 'Combos' : 'Products'}
              </h2>
              <p className="text-xs lg:text-sm text-gray-500 mt-1">
                {showCombos ? `${filteredCombos.length} combos available` : `${filteredProducts.length} products available`}
                {!showCombos && state.products.filter(p => p.active && p.shortcutKey !== undefined && p.shortcutKey !== null).length > 0 && (
                  <span className="ml-2 text-indigo-600 font-medium">
                    • {state.products.filter(p => p.active && p.shortcutKey !== undefined && p.shortcutKey !== null).length} with shortcuts (Ctrl+1-9,0)
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCombos(!showCombos)}
                className="px-3 py-2 lg:px-4 lg:py-2 text-xs lg:text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center whitespace-nowrap"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                {showCombos ? 'Show Products' : 'Show Combos'}
              </button>
            {state.currentShift ? (
              <button
                onClick={handleCloseShift}
                className="px-3 py-2 lg:px-4 lg:py-2 text-xs lg:text-sm font-medium bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center whitespace-nowrap"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Close Shift
              </button>
            ) : (
              <button
                onClick={() => {
                  setUserDismissedShiftModal(false);
                  setShowOpenShift(true);
                }}
                className="px-3 py-2 lg:px-4 lg:py-2 text-xs lg:text-sm font-medium bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl hover:from-yellow-600 hover:to-orange-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center whitespace-nowrap"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Open Shift
              </button>
            )}
            </div>
          </div>
          <div className="mb-4 lg:mb-6 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder={showCombos ? "Search combos (Press /)" : "Search products (Press /)"}
                className="w-full pl-10 pr-4 py-3 lg:py-4 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-white focus:bg-white font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {!showCombos && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 lg:px-5 py-3 lg:py-4 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-white focus:bg-white font-semibold cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {showCombos ? (
              filteredCombos.map((combo, index) => (
                <div
                  key={combo.id}
                  onClick={() => handleAddComboToCart(combo)}
                  className="group relative p-5 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl cursor-pointer card-hover animate-slide-up"
                  style={{ animationDelay: `${index * 0.03}s`, animationFillMode: 'both' }}
                >
                  <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                    COMBO
                  </div>
                  <div className="flex items-start justify-between mb-1.5 pt-2">
                    <div className="font-semibold text-base lg:text-lg text-gray-900 group-hover:text-purple-600 transition-colors flex-1">{combo.name}</div>
                  </div>
                  {combo.description && (
                    <div className="text-xs lg:text-sm text-gray-600 mb-3">{combo.description}</div>
                  )}
                  <div className="text-xs lg:text-sm text-gray-600 mb-3">
                    {combo.items.length} item{combo.items.length !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-baseline justify-between mt-4">
                    <div className="font-bold text-2xl lg:text-3xl text-purple-700">
                      ${calculateComboPrice(combo).toFixed(2)}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-purple-600 font-medium flex items-center">
                    Click to add all items to cart
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </div>
              ))
            ) : (
              filteredProducts.map((product, index) => (
              <div
                key={product.id}
                onClick={() => handleAddToCart(product)}
                className={`group relative p-5 bg-gradient-to-br from-white to-gray-50 border-2 ${
                  (product.shortcutKey !== undefined && product.shortcutKey !== null) ? 'border-indigo-300' : 'border-gray-200'
                } rounded-xl cursor-pointer card-hover ${
                  product.stockQty === 0 ? 'opacity-50 cursor-not-allowed' : ''
                } animate-slide-up`}
                style={{ animationDelay: `${index * 0.03}s`, animationFillMode: 'both' }}
              >
                {product.stockQty === 0 && (
                  <div className="absolute top-2 right-2 bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full z-10">
                    Out of Stock
                  </div>
                )}
                {/* Shortcut Key Badge - Always visible, prominent display */}
                {(product.shortcutKey !== undefined && product.shortcutKey !== null) ? (
                  <div className="absolute top-2 left-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm lg:text-base font-bold px-3 py-2 rounded-lg shadow-lg border-2 border-indigo-800 z-10">
                    Ctrl+{product.shortcutKey === 0 ? '0' : product.shortcutKey}
                  </div>
                ) : (
                  <div className="absolute top-2 left-2 bg-gray-200 text-gray-500 text-xs font-medium px-2 py-1.5 rounded-lg border border-gray-300 z-10">
                    No Shortcut
                  </div>
                )}
                <div className="flex items-start justify-between mb-1.5 pt-8">
                  <div className="font-semibold text-base lg:text-lg text-gray-900 group-hover:text-indigo-600 transition-colors flex-1">{product.name}</div>
                </div>
                <div className="text-xs lg:text-sm text-gray-600 mb-3 uppercase tracking-wide">{product.category}</div>
                <div className="flex items-baseline justify-between mt-4">
                  <div className="font-bold text-2xl lg:text-3xl text-indigo-700">
                    ${product.price.toFixed(2)}
                  </div>
                  <div className={`text-xs lg:text-sm font-semibold px-3 py-1.5 rounded-full ${
                    product.stockQty < 10 
                      ? 'bg-red-100 text-red-800' 
                      : product.stockQty < 20
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {product.stockQty} in stock
                  </div>
                </div>
                {/* Show shortcut hint if available, otherwise show click hint */}
                {(product.shortcutKey !== undefined && product.shortcutKey !== null) ? (
                  <div className="mt-3 text-xs text-indigo-600 font-medium flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Press Ctrl+{product.shortcutKey === 0 ? '0' : product.shortcutKey} or click to add
                  </div>
                ) : (
                  <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-xs text-indigo-600 font-medium flex items-center">
                      Click to add
                      <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="w-full lg:w-1/3 bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft p-4 lg:p-6 flex flex-col border border-gray-200/50 relative" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
          <div className="mb-4 lg:mb-6 flex-shrink-0">
            <h2 className="text-2xl lg:text-3xl font-bold text-indigo-700 mb-2">
              Shopping Cart
            </h2>
            <p className="text-sm lg:text-base text-gray-600 font-medium">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
          </div>
          
          {/* Scrollable Cart Items */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 animate-fade-in">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <p className="text-lg font-medium">Cart is empty</p>
                <p className="text-sm">Add products to get started</p>
              </div>
            ) : (
              cart.map((item, index) => {
                const product = state.products.find(p => p.id === item.productId)!;
                return (
                  <div 
                    key={item.productId} 
                    className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-4 animate-scale-in shadow-sm hover:shadow-md transition-all duration-200"
                    style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'both' }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="font-semibold text-base lg:text-lg text-gray-900 mb-1.5">{product.name}</div>
                        <div className="text-sm lg:text-base text-gray-700 font-medium">${item.unitPrice.toFixed(2)} × {item.qty}</div>
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(item.productId)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2.5 rounded-lg transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label="Remove item"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        onClick={() => handleUpdateCartItem(item.productId, { qty: Math.max(1, item.qty - 1) })}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-xl text-gray-700 transition-colors duration-200"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="min-w-[50px] text-center font-bold text-lg lg:text-xl text-gray-900">{item.qty}</span>
                      <button
                        onClick={() => {
                          if (item.qty < product.stockQty) {
                            handleUpdateCartItem(item.productId, { qty: item.qty + 1 });
                          } else {
                            showToast('Insufficient stock', 'error');
                          }
                        }}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg font-bold text-xl transition-colors duration-200"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                      <input
                        type="number"
                        placeholder="Discount"
                        value={item.discountAmount || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const maxDiscount = item.unitPrice * item.qty;
                          handleUpdateCartItem(item.productId, { discountAmount: Math.min(val, maxDiscount) });
                        }}
                        className="ml-auto w-28 px-3 py-2.5 border-2 border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
                      <span className="text-base font-semibold text-gray-700">Line Total:</span>
                      <span className="font-bold text-lg lg:text-xl text-gray-900">
                        ${(item.unitPrice * item.qty - item.discountAmount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Fixed Footer at Bottom */}
          {cart.length > 0 && (
            <div className="sticky bottom-0 bg-white/98 backdrop-blur-md pt-4 -mx-4 -mb-4 px-4 pb-4 border-t-2 border-gray-200 flex-shrink-0 space-y-3 shadow-lg">
              {/* Create Combo Button */}
              <button
                onClick={handleCreateComboFromCart}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-sm lg:text-base"
              >
                <svg className="w-4 h-4 lg:w-5 lg:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Combo from Cart
              </button>
              <div className="space-y-3">
                <div className="flex justify-between text-base lg:text-lg">
                  <span className="font-semibold text-gray-700">Subtotal:</span>
                  <span className="font-bold text-gray-900">${totals.subTotal.toFixed(2)}</span>
                </div>
                {totals.discountTotal > 0 && (
                  <div className="flex justify-between text-base lg:text-lg">
                    <span className="font-semibold text-gray-700">Discount:</span>
                    <span className="font-bold text-red-700">-${totals.discountTotal.toFixed(2)}</span>
                  </div>
                )}
                {state.settings.taxEnabled && totals.taxTotal > 0 && (
                  <div className="flex justify-between text-base lg:text-lg">
                    <span className="font-semibold text-gray-700">Tax:</span>
                    <span className="font-bold text-gray-900">${totals.taxTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center pt-4 mt-4 border-t-4 border-gray-400">
                <span className="text-xl lg:text-2xl font-bold text-gray-900">Total:</span>
                <span className="text-3xl lg:text-4xl font-extrabold text-indigo-700">
                  ${totals.grandTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  onClick={handleVoidCart}
                  className="flex-1 min-h-[56px] px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-all duration-200 hover:shadow-md flex items-center justify-center text-base lg:text-lg border-2 border-gray-300"
                >
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Void
                </button>
                <button
                  onClick={handleCheckout}
                  className="flex-1 min-h-[56px] px-6 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-base lg:text-lg border-2 border-indigo-700"
                >
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Checkout
                  <span className="ml-3 text-sm opacity-90 hidden sm:inline font-normal">Ctrl+Enter</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* All Modals */}
      {/* Checkout Modal */}
      <Modal isOpen={showCheckout} onClose={() => setShowCheckout(false)} title="Checkout" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-base font-bold mb-4 text-gray-900">Payment Method</label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="cash"
                  checked={paymentMethod === 'cash'}
                  onChange={(e) => setPaymentMethod(e.target.value as 'cash')}
                  className="mr-3 w-5 h-5 cursor-pointer"
                />
                <span className="text-base font-semibold text-gray-800">Cash</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={(e) => setPaymentMethod(e.target.value as 'card')}
                  className="mr-3 w-5 h-5 cursor-pointer"
                />
                <span className="text-base font-semibold text-gray-800">Card</span>
              </label>
            </div>
          </div>
          {paymentMethod === 'cash' && (
            <div>
              <label className="block text-base font-bold mb-3 text-gray-900">Cash Received</label>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="w-full px-4 py-4 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-semibold"
                step="0.01"
                autoFocus
                placeholder="0.00"
              />
              {change > 0 && (
                <div className="mt-4 text-2xl font-extrabold text-green-700 bg-green-50 p-4 rounded-xl border-2 border-green-300">
                  Change: ${change.toFixed(2)}
                </div>
              )}
            </div>
          )}
          <div className="text-xl font-bold">
            Total: ${totals.grandTotal.toFixed(2)}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowCheckout(false)}
              className="min-h-[56px] px-6 py-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-all duration-200 border-2 border-gray-300 text-base lg:text-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCompleteSale}
              className="min-h-[56px] px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-indigo-700 text-base lg:text-lg"
            >
              Complete Sale
            </button>
          </div>
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={showReceipt} onClose={() => setShowReceipt(false)} title="Receipt" size="lg">
        {currentSale && (
          <div className="space-y-4">
            <div id="receipt-content" className="receipt-print">
              {/* Logo and Header */}
              <div className="receipt-header">
                <div className="receipt-logo">
                  <div className="logo-placeholder">
                    <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                </div>
                <h1 className="receipt-store-name">{state.settings.storeName}</h1>
                {state.settings.storeAddress && (
                  <div className="receipt-store-info">{state.settings.storeAddress}</div>
                )}
                {state.settings.storePhone && (
                  <div className="receipt-store-info">Tel: {state.settings.storePhone}</div>
                )}
                {state.settings.storeEmail && (
                  <div className="receipt-store-info">Email: {state.settings.storeEmail}</div>
                )}
                {state.settings.storeWebsite && (
                  <div className="receipt-store-info">{state.settings.storeWebsite}</div>
                )}
              </div>

              {/* Receipt Details */}
              <div className="receipt-divider"></div>
              <div className="receipt-section">
                <div className="receipt-row">
                  <span className="receipt-label">Receipt #:</span>
                  <span className="receipt-value">{currentSale.receiptNo}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Date:</span>
                  <span className="receipt-value">{new Date(currentSale.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Time:</span>
                  <span className="receipt-value">{new Date(currentSale.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Cashier:</span>
                  <span className="receipt-value">
                    {state.users.find(u => u.id === currentSale.cashierUserId)?.username || 'Unknown'}
                  </span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Transaction ID:</span>
                  <span className="receipt-value">{currentSale.id.slice(-8).toUpperCase()}</span>
                </div>
              </div>

              <div className="receipt-divider"></div>

              {/* Items Table */}
              <div className="receipt-items-header">
                <div className="receipt-item-col-qty">Qty</div>
                <div className="receipt-item-col-desc">Description</div>
                <div className="receipt-item-col-price">Price</div>
                <div className="receipt-item-col-total">Total</div>
              </div>
              <div className="receipt-divider"></div>

              {currentSale.items.map((item) => {
                const product = state.products.find(p => p.id === item.productId)!;
                const itemTotal = item.unitPrice * item.qty;
                const itemSubtotal = itemTotal - item.discountAmount;
                const itemTax = itemSubtotal * product.taxRate;
                const itemLineTotal = itemSubtotal + (state.settings.taxEnabled ? itemTax : 0);

                return (
                  <div key={item.productId} className="receipt-item">
                    <div className="receipt-item-row">
                      <div className="receipt-item-col-qty">{item.qty}</div>
                      <div className="receipt-item-col-desc">
                        <div className="receipt-item-name">{product.name}</div>
                        <div className="receipt-item-details">
                          SKU: {product.sku} | {product.category}
                        </div>
                        {item.discountAmount > 0 && (
                          <div className="receipt-item-discount">
                            Discount: -${item.discountAmount.toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div className="receipt-item-col-price">
                        @ ${item.unitPrice.toFixed(2)}
                      </div>
                      <div className="receipt-item-col-total">
                        ${itemLineTotal.toFixed(2)}
                      </div>
                    </div>
                    {state.settings.taxEnabled && itemTax > 0 && (
                      <div className="receipt-item-tax">
                        Tax ({product.taxRate * 100}%): ${itemTax.toFixed(2)}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="receipt-divider"></div>

              {/* Totals */}
              <div className="receipt-totals">
                <div className="receipt-total-row">
                  <span className="receipt-total-label">Items Subtotal:</span>
                  <span className="receipt-total-value">
                    ${(currentSale.subTotal + currentSale.discountTotal).toFixed(2)}
                  </span>
                </div>
                {currentSale.discountTotal > 0 && (
                  <div className="receipt-total-row receipt-discount">
                    <span className="receipt-total-label">Discount:</span>
                    <span className="receipt-total-value">-${currentSale.discountTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="receipt-total-row">
                  <span className="receipt-total-label">Subtotal (After Discount):</span>
                  <span className="receipt-total-value">${currentSale.subTotal.toFixed(2)}</span>
                </div>
                {state.settings.taxEnabled && currentSale.taxTotal > 0 && (
                  <>
                    <div className="receipt-total-row">
                      <span className="receipt-total-label">Tax Total:</span>
                      <span className="receipt-total-value">${currentSale.taxTotal.toFixed(2)}</span>
                    </div>
                    <div className="receipt-divider"></div>
                    <div className="receipt-total-row receipt-grand-total">
                      <span className="receipt-total-label">Total (After Tax):</span>
                      <span className="receipt-total-value">${currentSale.grandTotal.toFixed(2)}</span>
                    </div>
                  </>
                )}
                {(!state.settings.taxEnabled || currentSale.taxTotal === 0) && (
                  <>
                    <div className="receipt-divider"></div>
                    <div className="receipt-total-row receipt-grand-total">
                      <span className="receipt-total-label">Total:</span>
                      <span className="receipt-total-value">${currentSale.grandTotal.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="receipt-divider"></div>

              {/* Payment Details */}
              <div className="receipt-section">
                <div className="receipt-row">
                  <span className="receipt-label">Payment Method:</span>
                  <span className="receipt-value">
                    {currentSale.payments.cash ? 'Cash' : 'Card'}
                  </span>
                </div>
                {currentSale.payments.cash && cashReceivedForReceipt && parseFloat(cashReceivedForReceipt) > currentSale.grandTotal && (
                  <div className="receipt-row">
                    <span className="receipt-label">Cash Received:</span>
                    <span className="receipt-value">${parseFloat(cashReceivedForReceipt).toFixed(2)}</span>
                  </div>
                )}
                {currentSale.payments.cash && cashReceivedForReceipt && parseFloat(cashReceivedForReceipt) > currentSale.grandTotal && (
                  <div className="receipt-row receipt-change">
                    <span className="receipt-label">Change:</span>
                    <span className="receipt-value">
                      ${(parseFloat(cashReceivedForReceipt) - currentSale.grandTotal).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="receipt-row">
                  <span className="receipt-label">Amount Paid:</span>
                  <span className="receipt-value">
                    ${currentSale.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="receipt-divider"></div>

              {/* Footer */}
              {state.settings.returnPolicy && (
                <div className="receipt-footer-section">
                  <div className="receipt-footer-title">Return Policy</div>
                  <div className="receipt-footer-text">{state.settings.returnPolicy}</div>
                </div>
              )}

              <div className="receipt-divider"></div>

              <div className="receipt-thank-you">
                {state.settings.receiptFooter || 'Thank you for shopping with us!'}
              </div>

              <div className="receipt-footer-small">
                This is a computer-generated receipt. No signature required.
              </div>
            </div>
            <div className="flex justify-end gap-2 no-print">
              <button
                onClick={() => {
                  // Get receipt content
                  const receiptContent = document.getElementById('receipt-content');
                  if (!receiptContent) {
                    window.print();
                    return;
                  }

                  // Create a new window for printing
                  const printWindow = window.open('', '_blank', 'width=300,height=600');
                  if (!printWindow) {
                    // If popup blocked, fall back to regular print
                    window.print();
                    return;
                  }

                  // Get all the receipt CSS styles
                  const styles = Array.from(document.styleSheets)
                    .map(sheet => {
                      try {
                        return Array.from(sheet.cssRules)
                          .map(rule => rule.cssText)
                          .join('\n');
                      } catch (e) {
                        return '';
                      }
                    })
                    .join('\n');

                  // Write the receipt HTML with styles
                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <title>Receipt - ${currentSale.receiptNo}</title>
                        <style>
                          * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                          }
                          body {
                            font-family: 'Courier New', monospace;
                            background: white;
                            color: #000;
                            padding: 15px;
                            width: 80mm;
                            margin: 0 auto;
                          }
                          ${styles}
                          @media print {
                            @page {
                              size: 80mm auto;
                              margin: 0;
                            }
                            body {
                              padding: 15px;
                              width: 80mm;
                            }
                            .receipt-print {
                              width: 100% !important;
                              max-width: 100% !important;
                              margin: 0 !important;
                              padding: 15px !important;
                            }
                          }
                        </style>
                      </head>
                      <body>
                        ${receiptContent.outerHTML}
                      </body>
                    </html>
                  `);
                  
                  printWindow.document.close();
                  
                  // Wait for content to load, then print
                  setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    // Close window after printing (user may cancel, so use short timeout)
                    setTimeout(() => {
                      printWindow.close();
                    }, 500);
                  }, 500);
                }}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Print Receipt
              </button>
              <button
                onClick={() => {
                  setShowReceipt(false);
                  setCurrentSale(null);
                  setCashReceived('');
                  setCashReceivedForReceipt('');
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                New Sale
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Open Shift Modal */}
      <Modal isOpen={showOpenShift} onClose={handleCloseShiftModal} title="Open Shift" size="sm">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You need an open shift to process sales. You can close this dialog, but you'll need to open a shift before checkout.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Enter starting cash amount:</label>
            <input
              type="number"
              value={startingCash}
              onChange={(e) => setStartingCash(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
              placeholder="0.00"
              step="0.01"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCloseShiftModal}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleOpenShift}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
            >
              Open Shift
            </button>
          </div>
        </div>
      </Modal>

      {/* Close Shift Modal */}
      <Modal isOpen={showCloseShift} onClose={() => setShowCloseShift(false)} title="Close Shift" size="sm">
        {state.currentShift && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <div>Starting Cash: ${state.currentShift.startingCash.toFixed(2)}</div>
              <div>
                Expected Cash: ${(state.currentShift.startingCash + state.sales
                  .filter(s => s.createdAt >= state.currentShift!.openedAt && s.payments.cash)
                  .reduce((sum, s) => sum + (s.payments.cash || 0), 0) - state.returns
                  .filter(r => r.createdAt >= state.currentShift!.openedAt && r.refundMethod === 'CASH')
                  .reduce((sum, r) => sum + r.refundTotal, 0)).toFixed(2)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Actual Cash Counted</label>
              <input
                type="number"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                step="0.01"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCloseShift(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCloseShift}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Close Shift
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Void Cart PIN Modal */}
      <PINModal
        isOpen={showVoidModal}
        onClose={() => {
          setShowVoidModal(false);
        }}
        onConfirm={handleVoidWithPIN}
        title="Void Cart - Manager Approval"
      />

      {/* Create Combo Modal */}
      <Modal
        isOpen={showCreateComboModal}
        onClose={() => {
          setShowCreateComboModal(false);
          setComboName('');
          setComboDescription('');
        }}
        title="Create Combo from Cart"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-base font-medium mb-1">Combo Name *</label>
            <input
              type="text"
              value={comboName}
              onChange={(e) => setComboName(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-gray-50 focus:bg-white"
              placeholder="e.g., Breakfast Special"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-1">Description (Optional)</label>
            <textarea
              value={comboDescription}
              onChange={(e) => setComboDescription(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-gray-50 focus:bg-white"
              rows={3}
              placeholder="A brief description of the combo"
            />
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Items in Combo:</h3>
            {cart.length === 0 ? (
              <p className="text-gray-500">No items in cart to create combo.</p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto border p-3 rounded-lg bg-gray-50">
                {cart.map(item => {
                  const product = state.products.find(p => p.id === item.productId);
                  return (
                    <li key={item.productId} className="flex justify-between text-sm text-gray-700">
                      <span>{product?.name}</span>
                      <span>{item.qty} x ${item.unitPrice.toFixed(2)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => {
                setShowCreateComboModal(false);
                setComboName('');
                setComboDescription('');
              }}
              className="px-4 py-2 bg-gray-200 rounded-xl hover:bg-gray-300 text-base h-12"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCombo}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-base h-12"
              disabled={!comboName.trim() || cart.length === 0}
            >
              Save Combo
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
