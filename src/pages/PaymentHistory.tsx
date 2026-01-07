import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Sale, PaymentCancellation, CartItem } from '../types';
import { showToast } from '../utils/toast';
import Modal from '../components/Modal';
import PINModal from '../components/PINModal';
import jsPDF from 'jspdf';

interface CartItemWithRemaining extends CartItem {
  remainingQty: number;
}

export default function PaymentHistory() {
  const { state, dispatch } = useApp();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [cancellationItems, setCancellationItems] = useState<Array<{ item: CartItemWithRemaining; qty: number }>>([]);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [note, setNote] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPINModal, setShowPINModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'cash' | 'card'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PAID' | 'PARTIAL_CANCELLED' | 'REFUNDED' | 'CANCELLED'>('all');

  // Get all cancellations for a sale
  const getSaleCancellations = (saleId: string) => {
    if (!state.paymentCancellations || !Array.isArray(state.paymentCancellations)) return [];
    return state.paymentCancellations.filter(c => c && c.saleId === saleId);
  };

  // Calculate remaining quantities after cancellations
  const getRemainingQuantities = (sale: Sale): CartItemWithRemaining[] => {
    const cancellations = getSaleCancellations(sale.id);
    const cancelledQuantities = cancellations.reduce((acc, cancellation) => {
      cancellation.itemsCancelled.forEach(item => {
        acc[item.productId] = (acc[item.productId] || 0) + item.qty;
      });
      return acc;
    }, {} as Record<string, number>);

    return sale.items.map(item => ({
      ...item,
      remainingQty: item.qty - (cancelledQuantities[item.productId] || 0),
    }));
  };

  const handleSelectSale = (sale: Sale) => {
    if (sale.status === 'REFUNDED' || sale.status === 'CANCELLED') {
      showToast('Sale already fully refunded or cancelled', 'error');
      return;
    }

    const remainingItems = getRemainingQuantities(sale);
    // Only show items that still have remaining quantity to cancel
    const itemsWithRemaining = remainingItems.filter(item => item.remainingQty > 0);
    
    if (itemsWithRemaining.length === 0) {
      showToast('No items available to cancel for this sale', 'error');
      return;
    }

    setSelectedSale(sale);
    setCancellationItems(
      itemsWithRemaining.map(item => ({ 
        item: item as CartItemWithRemaining, 
        qty: 0 
      }))
    );
    setNote('');
    setShowModal(true);
  };

  const handleUpdateCancellationQty = (index: number, qty: number) => {
    const item = cancellationItems[index];
    if (qty < 0 || qty > item.item.remainingQty) {
      return;
    }
    const updated = [...cancellationItems];
    updated[index] = { ...item, qty };
    setCancellationItems(updated);
  };

  const handleProcessCancellation = () => {
    if (!selectedSale) return;

    const itemsToCancel = cancellationItems.filter(ci => ci.qty > 0);
    if (itemsToCancel.length === 0) {
      showToast('Please select items to cancel', 'error');
      return;
    }

    // Show PIN modal for manager approval
    setShowPINModal(true);
  };

  const handleConfirmCancellation = () => {
    if (!selectedSale || !state.currentUser) return;

    const itemsToCancel = cancellationItems.filter(ci => ci.qty > 0);
    const cancelledItems: CartItem[] = itemsToCancel.map(ci => ({
      ...ci.item,
      qty: ci.qty,
    }));

    // Calculate cancellation total
    const subTotal = cancelledItems.reduce((sum, item) => {
      const originalItem = selectedSale.items.find(i => i.productId === item.productId)!;
      const itemDiscount = (item.discountAmount * item.qty / originalItem.qty);
      return sum + (item.unitPrice * item.qty - itemDiscount);
    }, 0);

    const taxTotal = state.settings.taxEnabled
      ? cancelledItems.reduce((sum, item) => {
          const product = state.products.find(p => p.id === item.productId)!;
          const originalItem = selectedSale.items.find(i => i.productId === item.productId)!;
          const itemDiscount = (item.discountAmount * item.qty / originalItem.qty);
          const itemTotal = item.unitPrice * item.qty - itemDiscount;
          return sum + itemTotal * product.taxRate;
        }, 0)
      : 0;

    const cancellationTotal = subTotal + taxTotal;

    // Create cancellation record
    const cancellationRecord: PaymentCancellation = {
      id: Date.now().toString(),
      saleId: selectedSale.id,
      createdAt: new Date().toISOString(),
      managerUserId: state.currentUser!.id,
      itemsCancelled: cancelledItems,
      cancellationTotal: Math.round(cancellationTotal * 100) / 100,
      refundMethod,
      note,
    };

    dispatch({ type: 'ADD_PAYMENT_CANCELLATION', payload: cancellationRecord });

    // Update inventory
    cancelledItems.forEach(item => {
      dispatch({
        type: 'ADD_INVENTORY_EVENT',
        payload: {
          id: Date.now().toString() + item.productId,
          at: new Date().toISOString(),
          userId: state.currentUser!.id,
          productId: item.productId,
          type: 'CANCELLATION',
          qtyDelta: item.qty,
          note: `Cancellation for sale ${selectedSale.receiptNo}`,
        },
      });
    });

    // Update sale status - calculate remaining after this cancellation
    // Get previous cancellations + this new one
    const previousCancellations = getSaleCancellations(selectedSale.id);
    const allCancellations = [...previousCancellations, cancellationRecord];
    const totalCancelledQuantities = allCancellations.reduce((acc, cancellation) => {
      cancellation.itemsCancelled.forEach(item => {
        acc[item.productId] = (acc[item.productId] || 0) + item.qty;
      });
      return acc;
    }, {} as Record<string, number>);
    
    const allItemsCancelled = selectedSale.items.every(item => {
      const totalCancelled = totalCancelledQuantities[item.productId] || 0;
      return totalCancelled >= item.qty;
    });

    let newStatus: Sale['status'] = selectedSale.status;
    if (allItemsCancelled) {
      newStatus = 'CANCELLED';
    } else if (cancelledItems.length > 0) {
      newStatus = 'PARTIAL_CANCELLED';
    }

    const updatedSale: Sale = {
      ...selectedSale,
      status: newStatus,
    };
    dispatch({ type: 'UPDATE_SALE', payload: updatedSale });

    // Add audit log
    dispatch({
      type: 'ADD_AUDIT_LOG',
      payload: {
        id: Date.now().toString(),
        at: new Date().toISOString(),
        userId: state.currentUser!.id,
        action: 'PAYMENT_CANCELLATION',
        details: `Payment cancelled for sale ${selectedSale.receiptNo}. Cancelled: $${cancellationTotal.toFixed(2)}`,
      },
    });

    showToast('Payment cancellation processed successfully', 'success');
    setShowModal(false);
    setShowPINModal(false);
    setSelectedSale(null);
    setCancellationItems([]);
    setNote('');
  };

  const filteredSales = useMemo(() => {
    if (!state.sales || !Array.isArray(state.sales)) return [];
    
    let filtered = [...state.sales];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(sale =>
        sale.receiptNo.toLowerCase().includes(query) ||
        new Date(sale.createdAt).toLocaleString().toLowerCase().includes(query)
      );
    }
    
    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.createdAt);
        
        if (dateFilter === 'today') {
          return saleDate >= today;
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return saleDate >= weekAgo;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return saleDate >= monthAgo;
        } else if (dateFilter === 'custom' && startDate && endDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          return saleDate >= start && saleDate <= end;
        }
        return true;
      });
    }
    
    // Payment method filter
    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(sale => {
        if (paymentMethodFilter === 'cash') return sale.payments?.cash;
        if (paymentMethodFilter === 'card') return sale.payments?.card;
        return true;
      });
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(sale => sale.status === statusFilter);
    }
    
    // Sort by date (newest first)
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state.sales, searchQuery, dateFilter, startDate, endDate, paymentMethodFilter, statusFilter]);

  // Calculate totals for filtered sales
  const totals = useMemo(() => {
    const sales = filteredSales;
    const totalSales = sales.reduce((sum, s) => sum + s.grandTotal, 0);
    const totalCancelled = sales.reduce((sum, s) => {
      const cancellations = getSaleCancellations(s.id);
      return sum + cancellations.reduce((cSum, c) => cSum + c.cancellationTotal, 0);
    }, 0);
    const totalCash = sales.filter(s => s.payments?.cash).reduce((sum, s) => sum + s.grandTotal, 0);
    const totalCard = sales.filter(s => s.payments?.card).reduce((sum, s) => sum + s.grandTotal, 0);
    const totalNet = totalSales - totalCancelled;
    
    return {
      totalSales,
      totalCancelled,
      totalCash,
      totalCard,
      totalNet,
      count: sales.length,
    };
  }, [filteredSales]);

  // Generate PDF report
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF('landscape'); // Use landscape for better ledger layout
      let yPos = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const rightMargin = pageWidth - margin;

      // Helper function to add new page if needed
      const checkNewPage = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - margin) {
          doc.addPage('landscape');
          yPos = 20;
          return true;
        }
        return false;
      };

      // Header Section with Logo and Store Info
      doc.setFillColor(102, 126, 234);
      doc.roundedRect(margin, yPos, 35, 35, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('POS', margin + 17.5, yPos + 22, { align: 'center' });

      // Store Info (Right side of header)
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(state.settings.storeName || 'Store', margin + 45, yPos + 10);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      let infoY = yPos + 18;
      if (state.settings.storeAddress) {
        doc.text(state.settings.storeAddress, margin + 45, infoY);
        infoY += 5;
      }
      if (state.settings.storePhone) {
        doc.text(`Tel: ${state.settings.storePhone}`, margin + 45, infoY);
        infoY += 5;
      }
      if (state.settings.storeEmail) {
        doc.text(`Email: ${state.settings.storeEmail}`, margin + 45, infoY);
      }

      // Report Title and Period (Right aligned)
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PAYMENT HISTORY LEDGER', rightMargin, yPos + 10, { align: 'right' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      let periodText = 'All Time';
      if (dateFilter === 'today') {
        periodText = `Today - ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
      } else if (dateFilter === 'week') {
        periodText = 'Last 7 Days';
      } else if (dateFilter === 'month') {
        periodText = 'Last 30 Days';
      } else if (dateFilter === 'custom' && startDate && endDate) {
        const start = new Date(startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const end = new Date(endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        periodText = `${start} to ${end}`;
      }
      doc.text(`Period: ${periodText}`, rightMargin, yPos + 18, { align: 'right' });
      doc.text(`Generated: ${new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, rightMargin, yPos + 26, { align: 'right' });

      yPos += 45;
      
      // Divider line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, rightMargin, yPos);
      yPos += 8;

      // Summary Section (Boxed)
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(margin, yPos, rightMargin - margin, 35, 3, 3, 'F');
      
      const summaryStartY = yPos + 5;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('SUMMARY', margin + 5, summaryStartY);

      // Summary in two columns
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const col1X = margin + 5;
      const col2X = margin + 100;
      const col3X = margin + 195;
      
      doc.text('Total Sales:', col1X, summaryStartY + 10);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${totals.totalSales.toFixed(2)}`, col1X + 40, summaryStartY + 10, { align: 'right' });
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 0, 0);
      doc.text('Total Cancelled:', col2X, summaryStartY + 10);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${totals.totalCancelled.toFixed(2)}`, col2X + 40, summaryStartY + 10, { align: 'right' });
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text('Net Sales:', col3X, summaryStartY + 10);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${totals.totalNet.toFixed(2)}`, col3X + 35, summaryStartY + 10, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('Cash Payments:', col1X, summaryStartY + 20);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${totals.totalCash.toFixed(2)}`, col1X + 40, summaryStartY + 20, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.text('Card Payments:', col2X, summaryStartY + 20);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${totals.totalCard.toFixed(2)}`, col2X + 40, summaryStartY + 20, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.text('Total Transactions:', col3X, summaryStartY + 20);
      doc.setFont('helvetica', 'bold');
      doc.text(`${totals.count}`, col3X + 50, summaryStartY + 20, { align: 'right' });

      yPos += 45;

      checkNewPage(25);
      
      // Table Header with background
      doc.setFillColor(102, 126, 234);
      doc.roundedRect(margin, yPos - 3, rightMargin - margin, 8, 2, 2, 'F');
      
      const colWidths = [30, 55, 35, 25, 28, 32, 32, 32]; // Date, Receipt, Cashier, Items, Payment, Amount, Cancelled, Balance
      const headers = ['Date', 'Receipt #', 'Cashier', 'Items', 'Payment', 'Amount', 'Cancelled', 'Balance'];
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      let headerX = margin;
      headers.forEach((header, idx) => {
        const align = idx >= 4 ? 'right' : 'left'; // Right align for numeric columns
        doc.text(header, headerX + (align === 'right' ? colWidths[idx] - 2 : 2), yPos, {
          align: align as any,
          maxWidth: colWidths[idx] - 4,
        });
        headerX += colWidths[idx];
      });

      yPos += 10;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, rightMargin, yPos);
      yPos += 5;

      // Table Rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      let runningBalance = 0;

      filteredSales.forEach((sale, index) => {
        checkNewPage(12);
        
        const cancellations = getSaleCancellations(sale.id);
        const cancelledAmount = cancellations.reduce((sum, c) => sum + c.cancellationTotal, 0);
        const cashier = state.users.find(u => u.id === sale.cashierUserId);
        const itemCount = sale.items.reduce((sum, item) => sum + item.qty, 0);
        
        // Date formatting (MM/DD/YYYY)
        const date = new Date(sale.createdAt);
        const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
        const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        runningBalance += sale.grandTotal - cancelledAmount;
        
        const isCancelled = sale.status === 'REFUNDED' || sale.status === 'CANCELLED';
        const isPartialCancelled = sale.status === 'PARTIAL_CANCELLED';
        
        // Set text color based on status
        if (isCancelled) {
          doc.setTextColor(150, 150, 150); // Gray for cancelled
        } else if (isPartialCancelled) {
          doc.setTextColor(200, 120, 0); // Orange for partial
        } else {
          doc.setTextColor(0, 0, 0);
        }

        let colX = margin;
        
        // Date
        doc.text(formattedDate, colX + 2, yPos);
        doc.setFontSize(7);
        doc.text(time, colX + 2, yPos + 4);
        doc.setFontSize(8);
        colX += colWidths[0];

        // Receipt #
        doc.text(sale.receiptNo, colX + 2, yPos, { maxWidth: colWidths[1] - 4 });
        colX += colWidths[1];

        // Cashier
        doc.text(cashier?.username || 'Unknown', colX + 2, yPos, { maxWidth: colWidths[2] - 4 });
        colX += colWidths[2];

        // Items (quantity)
        doc.text(itemCount.toString(), colX + colWidths[3] - 2, yPos, { align: 'right' });
        colX += colWidths[3];

        // Payment Method
        const paymentMethod = sale.payments?.cash ? 'Cash' : 'Card';
        doc.text(paymentMethod, colX + 2, yPos, { maxWidth: colWidths[4] - 4 });
        colX += colWidths[4];

        // Amount (right aligned)
        if (isCancelled) {
          // Strikethrough effect for cancelled
          doc.line(colX + 2, yPos - 1, colX + colWidths[5] - 2, yPos - 1);
        }
        doc.text(`$${sale.grandTotal.toFixed(2)}`, colX + colWidths[5] - 2, yPos, { align: 'right' });
        colX += colWidths[5];

        // Cancelled Amount (right aligned, red if > 0)
        if (cancelledAmount > 0) {
          doc.setTextColor(200, 0, 0);
          doc.setFont('helvetica', 'bold');
          doc.text(`$${cancelledAmount.toFixed(2)}`, colX + colWidths[6] - 2, yPos, { align: 'right' });
          doc.setFont('helvetica', 'normal');
        } else {
          doc.text('-', colX + colWidths[6] - 2, yPos, { align: 'right' });
        }
        colX += colWidths[6];

        // Running Balance (right aligned, bold)
        doc.setFont('helvetica', 'bold');
        if (isCancelled || isPartialCancelled) {
          doc.setTextColor(150, 150, 150);
        } else {
          doc.setTextColor(0, 0, 0);
        }
        doc.text(`$${runningBalance.toFixed(2)}`, colX + colWidths[7] - 2, yPos, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        
        // Reset color
        doc.setTextColor(0, 0, 0);
        
        yPos += 8;

        // Light separator line every 5 rows
        if ((index + 1) % 5 === 0 && index < filteredSales.length - 1) {
          doc.setDrawColor(240, 240, 240);
          doc.setLineWidth(0.3);
          doc.line(margin, yPos - 2, rightMargin, yPos - 2);
          yPos += 2;
        }
      });

      // Final Totals Section
      checkNewPage(20);
      yPos += 5;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, rightMargin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      
      // Totals row
      let totalColX = margin;
      doc.text('TOTALS:', totalColX + 2, yPos);
      totalColX += colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4];
      
      // Total Amount
      doc.text(`$${totals.totalSales.toFixed(2)}`, totalColX + colWidths[5] - 2, yPos, { align: 'right' });
      totalColX += colWidths[5];
      
      // Total Cancelled
      doc.setTextColor(200, 0, 0);
      doc.text(`$${totals.totalCancelled.toFixed(2)}`, totalColX + colWidths[6] - 2, yPos, { align: 'right' });
      totalColX += colWidths[6];
      
      // Final Balance (Net)
      doc.setTextColor(0, 100, 0);
      doc.text(`$${totals.totalNet.toFixed(2)}`, totalColX + colWidths[7] - 2, yPos, { align: 'right' });

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        
        // Left footer: Report info
        doc.text(`Payment History Ledger`, margin, pageHeight - 8);
        
        // Center footer: Page number
        doc.text(
          `Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
        
        // Right footer: Date
        doc.text(
          new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
          rightMargin,
          pageHeight - 8,
          { align: 'right' }
        );
        
        // Bottom border
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 12, rightMargin, pageHeight - 12);
      }

      // Generate filename
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Payment_History_Ledger_${dateStr}.pdf`;
      doc.save(filename);
      showToast('PDF downloaded successfully', 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast('Error generating PDF', 'error');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
            Payment History & Cancellations
          </h1>
          <p className="text-sm text-gray-500">View sales and process payment cancellations</p>
        </div>
        <button
          onClick={handleDownloadPDF}
          disabled={filteredSales.length === 0}
          className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold rounded-xl hover:from-red-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Total Sales</div>
          <div className="text-2xl font-bold text-blue-700">${totals.totalSales.toFixed(2)}</div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200 rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Total Cancelled</div>
          <div className="text-2xl font-bold text-red-700">${totals.totalCancelled.toFixed(2)}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Net Sales</div>
          <div className="text-2xl font-bold text-green-700">${totals.totalNet.toFixed(2)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft p-4 lg:p-6 mb-6 border border-gray-200/50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by receipt number or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-white focus:bg-white font-medium"
            />
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-4 py-2.5 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-white focus:bg-white font-medium"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
              className="w-full px-4 py-2.5 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-white focus:bg-white font-medium"
            >
              <option value="all">All Payments</option>
              <option value="cash">Cash Only</option>
              <option value="card">Card Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-4 py-2.5 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-white focus:bg-white font-medium"
            >
              <option value="all">All Status</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL_CANCELLED">Partially Cancelled</option>
              <option value="REFUNDED">Refunded</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {dateFilter === 'custom' && (
            <>
              <div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-white focus:bg-white font-medium"
                  placeholder="Start Date"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 bg-white focus:bg-white font-medium"
                  placeholder="End Date"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft overflow-hidden border border-gray-200/50">
        {filteredSales.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium">No payments found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cashier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cancellations</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSales.map((sale, index) => {
                const cancellations = getSaleCancellations(sale.id);
                const totalCancelled = cancellations.reduce((sum, c) => sum + c.cancellationTotal, 0);
                const cashier = state.users.find(u => u.id === sale.cashierUserId);
                return (
                  <tr
                    key={sale.id}
                    className="hover:bg-indigo-50/50 transition-colors duration-150 animate-slide-up"
                    style={{ animationDelay: `${index * 0.03}s`, animationFillMode: 'both' }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 font-mono">
                      {sale.receiptNo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(sale.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {cashier?.username || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ${sale.grandTotal.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {sale.payments?.cash ? 'Cash' : 'Card'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        sale.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        sale.status === 'REFUNDED' ? 'bg-red-100 text-red-700' :
                        sale.status === 'CANCELLED' ? 'bg-gray-100 text-gray-700' :
                        sale.status === 'PARTIAL_CANCELLED' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {sale.status ? sale.status.replace('_', ' ') : 'PAID'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {cancellations.length > 0 ? (
                        <span className="text-red-600 font-semibold">
                          ${totalCancelled.toFixed(2)} ({cancellations.length})
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleSelectSale(sale)}
                        disabled={sale.status === 'REFUNDED' || sale.status === 'CANCELLED'}
                        className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel Payment
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Cancellation Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedSale(null);
          setCancellationItems([]);
        }}
        title={`Cancel Payment - ${selectedSale?.receiptNo}`}
        size="lg"
      >
        {selectedSale && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Date:</strong> {new Date(selectedSale.createdAt).toLocaleString()}
              </div>
              <div>
                <strong>Original Total:</strong> ${selectedSale.grandTotal.toFixed(2)}
              </div>
            </div>

            <div>
              <strong className="text-base">Items - Select quantities to cancel:</strong>
              <div className="mt-3 space-y-3 max-h-96 overflow-y-auto">
                {cancellationItems.map((ci, index) => {
                  const product = state.products.find(p => p.id === ci.item.productId);
                  const originalItem = selectedSale.items.find(i => i.productId === ci.item.productId)!;
                  
                  return (
                    <div key={ci.item.productId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-base text-gray-900">{product?.name}</div>
                          <div className="text-sm text-gray-600">Original: {originalItem.qty} × ${ci.item.unitPrice.toFixed(2)}</div>
                          <div className="text-sm text-gray-600">Remaining: {ci.item.remainingQty} available to cancel</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleUpdateCancellationQty(index, Math.max(0, ci.qty - 1))}
                          disabled={ci.qty === 0}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-xl text-gray-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          −
                        </button>
                        <span className="min-w-[60px] text-center font-bold text-lg text-gray-900">{ci.qty}</span>
                        <button
                          onClick={() => handleUpdateCancellationQty(index, Math.min(ci.item.remainingQty, ci.qty + 1))}
                          disabled={ci.qty >= ci.item.remainingQty}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg font-bold text-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                        <button
                          onClick={() => handleUpdateCancellationQty(index, 0)}
                          className="ml-auto px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-all"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => handleUpdateCancellationQty(index, ci.item.remainingQty)}
                          className="px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          Cancel All
                        </button>
                      </div>
                      {ci.qty > 0 && (
                        <div className="mt-2 text-sm text-red-600 font-semibold">
                          Cancelling: {ci.qty} item(s) = ${((ci.item.unitPrice * ci.qty) - (ci.item.discountAmount * ci.qty / originalItem.qty)).toFixed(2)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Refund Method</label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="CASH"
                    checked={refundMethod === 'CASH'}
                    onChange={(e) => setRefundMethod(e.target.value as 'CASH')}
                    className="mr-3 w-5 h-5 cursor-pointer"
                  />
                  <span className="text-base font-semibold text-gray-800">Cash</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="CARD"
                    checked={refundMethod === 'CARD'}
                    onChange={(e) => setRefundMethod(e.target.value as 'CARD')}
                    className="mr-3 w-5 h-5 cursor-pointer"
                  />
                  <span className="text-base font-semibold text-gray-800">Card</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Note (Optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                rows={3}
                placeholder="Reason for cancellation..."
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold">Cancellation Total:</span>
                <span className="text-2xl font-bold text-red-600">
                  ${cancellationItems.reduce((sum, ci) => {
                    if (ci.qty === 0) return sum;
                    const originalItem = selectedSale.items.find(i => i.productId === ci.item.productId)!;
                    const itemDiscount = (ci.item.discountAmount * ci.qty / originalItem.qty);
                    const itemTotal = ci.item.unitPrice * ci.qty - itemDiscount;
                    const product = state.products.find(p => p.id === ci.item.productId)!;
                    const itemTax = state.settings.taxEnabled ? itemTotal * product.taxRate : 0;
                    return sum + itemTotal + itemTax;
                  }, 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedSale(null);
                  setCancellationItems([]);
                }}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-all duration-200 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessCancellation}
                className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all duration-200 min-h-[44px]"
              >
                Process Cancellation
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* PIN Modal */}
      <PINModal
        isOpen={showPINModal}
        onClose={() => setShowPINModal(false)}
        onConfirm={handleConfirmCancellation}
        title="Confirm Payment Cancellation"
        message="Enter Manager PIN to confirm cancellation:"
      />
    </div>
  );
}
