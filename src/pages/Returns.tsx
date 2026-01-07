import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Sale, Return, CartItem } from '../types';
import { showToast } from '../utils/toast';
import Modal from '../components/Modal';

export default function Returns() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<Array<{ item: CartItem; qty: number }>>([]);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [note, setNote] = useState('');
  const [showModal, setShowModal] = useState(false);

  const handleSelectSale = (sale: Sale) => {
    if (sale.status === 'REFUNDED') {
      showToast('Sale already fully refunded', 'error');
      return;
    }
    setSelectedSale(sale);
    setReturnItems(
      sale.items.map(item => ({ item, qty: 0 }))
    );
    setShowModal(true);
  };

  const handleUpdateReturnQty = (index: number, qty: number) => {
    const item = returnItems[index];
    if (qty < 0 || qty > item.item.qty) {
      return;
    }
    const updated = [...returnItems];
    updated[index] = { ...item, qty };
    setReturnItems(updated);
  };

  const handleProcessReturn = () => {
    if (!selectedSale) return;

    const itemsToReturn = returnItems.filter(ri => ri.qty > 0);
    if (itemsToReturn.length === 0) {
      showToast('Please select items to return', 'error');
      return;
    }

    const returnedItems: CartItem[] = itemsToReturn.map(ri => ({
      ...ri.item,
      qty: ri.qty,
    }));

    // Calculate refund total
    const subTotal = returnedItems.reduce((sum, item) => {
      return sum + (item.unitPrice * item.qty - (item.discountAmount * item.qty / (selectedSale.items.find(i => i.productId === item.productId)?.qty || 1)));
    }, 0);

    const taxTotal = state.settings.taxEnabled
      ? returnedItems.reduce((sum, item) => {
          const product = state.products.find(p => p.id === item.productId)!;
          const originalItem = selectedSale.items.find(i => i.productId === item.productId)!;
          const itemDiscount = (item.discountAmount * item.qty / originalItem.qty);
          const itemTotal = item.unitPrice * item.qty - itemDiscount;
          return sum + itemTotal * product.taxRate;
        }, 0)
      : 0;

    const refundTotal = subTotal + taxTotal;

    // Create return record
    const returnRecord: Return = {
      id: Date.now().toString(),
      saleId: selectedSale.id,
      createdAt: new Date().toISOString(),
      managerUserId: state.currentUser!.id,
      itemsReturned: returnedItems,
      refundMethod,
      refundTotal: Math.round(refundTotal * 100) / 100,
      note,
    };

    dispatch({ type: 'ADD_RETURN', payload: returnRecord });

    // Update sale status
    const allReturned = selectedSale.items.every(saleItem => {
      const returned = returnedItems.find(ri => ri.productId === saleItem.productId);
      return returned && returned.qty >= saleItem.qty;
    });

    const updatedSale: Sale = {
      ...selectedSale,
      status: allReturned ? 'REFUNDED' : 'PARTIAL_REFUND',
    };
    dispatch({ type: 'UPDATE_SALE', payload: updatedSale });

    // Update inventory
    returnedItems.forEach(item => {
      dispatch({
        type: 'ADD_INVENTORY_EVENT',
        payload: {
          id: Date.now().toString() + item.productId,
          at: new Date().toISOString(),
          userId: state.currentUser!.id,
          productId: item.productId,
          type: 'RETURN',
          qtyDelta: item.qty,
          note: `Return for sale ${selectedSale.receiptNo}`,
        },
      });

      const product = state.products.find(p => p.id === item.productId)!;
      dispatch({
        type: 'UPDATE_PRODUCT',
        payload: { ...product, stockQty: product.stockQty + item.qty },
      });
    });

    // Add audit log
    dispatch({
      type: 'ADD_AUDIT_LOG',
      payload: {
        id: Date.now().toString(),
        at: new Date().toISOString(),
        userId: state.currentUser!.id,
        action: 'PROCESS_RETURN',
        details: `Return processed for sale ${selectedSale.receiptNo}. Refund: $${refundTotal.toFixed(2)}`,
      },
    });

    showToast('Return processed successfully', 'success');
    setShowModal(false);
    setSelectedSale(null);
    setReturnItems([]);
    setNote('');
  };

  const recentSales = [...state.sales]
    .filter(s => s.status === 'PAID' || s.status === 'PARTIAL_REFUND')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Returns</h1>
        <button
          onClick={() => navigate('/reports')}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Back to Reports
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {recentSales.map(sale => (
              <tr key={sale.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {sale.receiptNo}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(sale.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${sale.grandTotal.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 rounded-full ${
                    sale.status === 'PAID' ? 'bg-green-100 text-green-800' :
                    sale.status === 'REFUNDED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {sale.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleSelectSale(sale)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    Process Return
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setReturnItems([]);
          setNote('');
        }}
        title={`Process Return - ${selectedSale?.receiptNo}`}
        size="lg"
      >
        {selectedSale && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Select Items to Return:</h3>
              <div className="space-y-2">
                {returnItems.map((returnItem, index) => {
                  const product = state.products.find(p => p.id === returnItem.item.productId);
                  const originalItem = selectedSale.items.find(i => i.productId === returnItem.item.productId)!;
                  return (
                    <div key={index} className="border rounded p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{product?.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-600">
                            Original Qty: {originalItem.qty} | Price: ${returnItem.item.unitPrice.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateReturnQty(index, Math.max(0, returnItem.qty - 1))}
                            className="px-2 py-1 bg-gray-200 rounded"
                          >
                            -
                          </button>
                          <span className="w-12 text-center">{returnItem.qty}</span>
                          <button
                            onClick={() => handleUpdateReturnQty(index, Math.min(originalItem.qty, returnItem.qty + 1))}
                            className="px-2 py-1 bg-gray-200 rounded"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Refund Method</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="CASH"
                    checked={refundMethod === 'CASH'}
                    onChange={(e) => setRefundMethod(e.target.value as 'CASH')}
                    className="mr-2"
                  />
                  Cash
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="CARD"
                    checked={refundMethod === 'CARD'}
                    onChange={(e) => setRefundMethod(e.target.value as 'CARD')}
                    className="mr-2"
                  />
                  Card
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Note</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                rows={3}
                placeholder="Optional note..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowModal(false);
                  setReturnItems([]);
                  setNote('');
                }}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessReturn}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Process Return
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
