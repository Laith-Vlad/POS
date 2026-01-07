import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Sale } from '../types';
import { showToast } from '../utils/toast';
import Modal from '../components/Modal';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type TimelinePreset = 'week' | 'month' | 'year' | 'custom';

export default function Reports() {
  const { state } = useApp();
  const navigate = useNavigate();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);
  const [timelinePreset, setTimelinePreset] = useState<TimelinePreset>('week');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  today.setHours(0, 0, 0, 0);

  // Calculate date range based on preset
  const dateRange = useMemo(() => {
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    let start: Date;

    switch (timelinePreset) {
      case 'week':
        start = new Date(today);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start = new Date(today);
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        break;
      case 'year':
        start = new Date(today);
        start.setFullYear(start.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        if (startDate && endDate) {
          start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          end.setTime(new Date(endDate).getTime());
          end.setHours(23, 59, 59, 999);
        } else {
          // Default to week if custom dates not set
          start = new Date(today);
          start.setDate(start.getDate() - 6);
          start.setHours(0, 0, 0, 0);
        }
        break;
      default:
        start = new Date(today);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
    }

    return { start, end };
  }, [timelinePreset, startDate, endDate, today]);

  // Filter sales by date range
  const filteredSales = useMemo(() => {
    return state.sales.filter(s => {
      const saleDate = new Date(s.createdAt);
      return saleDate >= dateRange.start && saleDate <= dateRange.end;
    });
  }, [state.sales, dateRange]);

  // Filter returns by date range
  const filteredReturns = useMemo(() => {
    return state.returns.filter(r => {
      const returnDate = new Date(r.createdAt);
      return returnDate >= dateRange.start && returnDate <= dateRange.end;
    });
  }, [state.returns, dateRange]);

  const todaySales = filteredSales.filter(s => {
    const saleDate = new Date(s.createdAt);
    return saleDate >= today;
  });

  const todayTotal = todaySales.reduce((sum, s) => sum + s.grandTotal, 0);
  const periodTotal = filteredSales.reduce((sum, s) => sum + s.grandTotal, 0);
  const averageBasket = filteredSales.length > 0
    ? periodTotal / filteredSales.length
    : 0;
  const returnsTotal = filteredReturns.reduce((sum, r) => sum + r.refundTotal, 0);

  // Generate date range for chart based on preset
  const chartDates = useMemo(() => {
    const dates: Date[] = [];
    const { start, end } = dateRange;

    if (timelinePreset === 'year') {
      // Show monthly data for year view
      const current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
      }
    } else if (timelinePreset === 'month') {
      // Show weekly data for month view
      const current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 7);
      }
    } else {
      // Show daily data for week and custom
      const current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }

    return dates;
  }, [dateRange, timelinePreset]);

  const salesByDay = useMemo(() => {
    if (timelinePreset === 'year') {
      // Group by month
      return chartDates.map(date => {
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthSales = filteredSales.filter(s => {
          const saleDate = new Date(s.createdAt);
          return saleDate >= monthStart && saleDate <= monthEnd;
        });
        return {
          date: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          sales: monthSales.reduce((sum, s) => sum + s.grandTotal, 0),
        };
      });
    } else if (timelinePreset === 'month') {
      // Group by week
      return chartDates.map((date, index) => {
        const weekStart = new Date(date);
        const weekEnd = new Date(date);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        const weekSales = filteredSales.filter(s => {
          const saleDate = new Date(s.createdAt);
          return saleDate >= weekStart && saleDate <= weekEnd;
        });
        return {
          date: `Week ${index + 1}`,
          sales: weekSales.reduce((sum, s) => sum + s.grandTotal, 0),
        };
      });
    } else {
      // Group by day
      return chartDates.map(date => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        const daySales = filteredSales.filter(s => {
          const saleDate = new Date(s.createdAt);
          return saleDate >= dayStart && saleDate <= dayEnd;
        });
        return {
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sales: daySales.reduce((sum, s) => sum + s.grandTotal, 0),
        };
      });
    }
  }, [chartDates, filteredSales, timelinePreset]);

  const paymentData = useMemo(() => [
    {
      name: 'Cash',
      value: filteredSales.reduce((sum, s) => sum + (s.payments.cash || 0), 0),
    },
    {
      name: 'Card',
      value: filteredSales.reduce((sum, s) => sum + (s.payments.card || 0), 0),
    },
  ], [filteredSales]);

  const COLORS = ['#3b82f6', '#10b981'];

  const topProducts = useMemo(() => {
    return filteredSales
      .flatMap(sale => sale.items.map(item => ({
        productId: item.productId,
        revenue: (item.unitPrice * item.qty - item.discountAmount) * (1 + (state.products.find(p => p.id === item.productId)?.taxRate || 0)),
      })))
      .reduce((acc, item) => {
        const existing = acc.find(p => p.productId === item.productId);
        if (existing) {
          existing.revenue += item.revenue;
        } else {
          acc.push({ productId: item.productId, revenue: item.revenue });
        }
        return acc;
      }, [] as { productId: string; revenue: number }[])
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(item => ({
        name: state.products.find(p => p.id === item.productId)?.name || 'Unknown',
        revenue: Math.round(item.revenue * 100) / 100,
      }));
  }, [filteredSales, state.products]);

  const handleSaleClick = (sale: Sale) => {
    setSelectedSale(sale);
    setShowSaleDetails(true);
  };

  const recentSales = useMemo(() => {
    return [...filteredSales].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 10);
  }, [filteredSales]);

  const handlePresetChange = (preset: TimelinePreset) => {
    setTimelinePreset(preset);
    if (preset !== 'custom') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleCustomDateApply = () => {
    if (!startDate || !endDate) {
      showToast('Please select both start and end dates', 'error');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      showToast('Start date must be before end date', 'error');
      return;
    }
    setTimelinePreset('custom');
  };

  // Get formatted date range display
  const dateRangeDisplay = useMemo(() => {
    if (timelinePreset === 'custom' && startDate && endDate) {
      return `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
    }
    return `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`;
  }, [timelinePreset, startDate, endDate, dateRange]);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
          Reports & Analytics
        </h1>
        <p className="text-sm text-gray-500">Sales insights and performance metrics</p>
      </div>

      {/* Timeline Filter */}
      <div className="mb-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft p-6 border border-gray-200/50">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Time Period</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handlePresetChange('week')}
                className={`px-4 py-2 text-base font-semibold rounded-xl transition-all duration-200 min-h-[44px] ${
                  timelinePreset === 'week'
                    ? 'bg-indigo-600 text-white border-2 border-indigo-700'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => handlePresetChange('month')}
                className={`px-4 py-2 text-base font-semibold rounded-xl transition-all duration-200 min-h-[44px] ${
                  timelinePreset === 'month'
                    ? 'bg-indigo-600 text-white border-2 border-indigo-700'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => handlePresetChange('year')}
                className={`px-4 py-2 text-base font-semibold rounded-xl transition-all duration-200 min-h-[44px] ${
                  timelinePreset === 'year'
                    ? 'bg-indigo-600 text-white border-2 border-indigo-700'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Last Year
              </button>
              <button
                onClick={() => {
                  setTimelinePreset('custom');
                  if (!startDate || !endDate) {
                    // Set default custom range (last 7 days)
                    const defaultEnd = new Date(today);
                    const defaultStart = new Date(today);
                    defaultStart.setDate(defaultStart.getDate() - 6);
                    setStartDate(defaultStart.toISOString().split('T')[0]);
                    setEndDate(defaultEnd.toISOString().split('T')[0]);
                  }
                }}
                className={`px-4 py-2 text-base font-semibold rounded-xl transition-all duration-200 min-h-[44px] ${
                  timelinePreset === 'custom'
                    ? 'bg-indigo-600 text-white border-2 border-indigo-700'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Custom Range
              </button>
            </div>
          </div>
          
          {timelinePreset === 'custom' && (
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate || new Date().toISOString().split('T')[0]}
                  className="px-4 py-2.5 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={new Date().toISOString().split('T')[0]}
                  className="px-4 py-2.5 text-base border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium"
                />
              </div>
              <button
                onClick={handleCustomDateApply}
                className="px-6 py-2.5 text-base font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 min-h-[44px] border-2 border-indigo-700"
              >
                Apply
              </button>
            </div>
          )}
        </div>
        {timelinePreset !== 'custom' && (
          <div className="mt-4 text-sm text-gray-600 font-medium">
            Showing data from: {dateRangeDisplay}
          </div>
        )}
        {timelinePreset === 'custom' && startDate && endDate && (
          <div className="mt-4 text-sm text-gray-600 font-medium">
            Selected range: {dateRangeDisplay}
          </div>
        )}
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-xl shadow-soft border border-indigo-200/50 card-hover">
          <div className="text-sm font-medium text-indigo-700 mb-2">Today Sales</div>
          <div className="text-3xl font-bold text-indigo-900">${todayTotal.toFixed(2)}</div>
          <div className="mt-2 text-xs text-indigo-600">{todaySales.length} transactions</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow-soft border border-purple-200/50 card-hover">
          <div className="text-sm font-medium text-purple-700 mb-2">Period Total</div>
          <div className="text-3xl font-bold text-purple-900">${periodTotal.toFixed(2)}</div>
          <div className="mt-2 text-xs text-purple-600">{filteredSales.length} transactions</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow-soft border border-green-200/50 card-hover">
          <div className="text-sm font-medium text-green-700 mb-2">Avg Basket</div>
          <div className="text-3xl font-bold text-green-900">${averageBasket.toFixed(2)}</div>
          <div className="mt-2 text-xs text-green-600">Per transaction</div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl shadow-soft border border-red-200/50 card-hover">
          <div className="text-sm font-medium text-red-700 mb-2">Returns Total</div>
          <div className="text-3xl font-bold text-red-900">-${returnsTotal.toFixed(2)}</div>
          <div className="mt-2 text-xs text-red-600">{state.returns.length} returns</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-soft border border-gray-200/50">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">
            Sales {timelinePreset === 'year' ? 'by Month' : timelinePreset === 'month' ? 'by Week' : 'by Day'}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sales" stroke="#3b82f6" name="Sales ($)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-soft border border-gray-200/50">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Payment Split</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products Table */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft mb-6 border border-gray-200/50">
        <h3 className="text-lg font-semibold p-4 lg:p-6 border-b border-gray-200 text-gray-900">Top 10 Products by Revenue</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {topProducts.map((product, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {product.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${product.revenue.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft border border-gray-200/50">
        <h3 className="text-lg font-semibold p-6 border-b border-gray-200 text-gray-900">Recent Sales</h3>
        <div className="overflow-x-auto">
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
            {recentSales.map((sale, index) => (
              <tr 
                key={sale.id} 
                className="hover:bg-indigo-50/50 cursor-pointer transition-colors duration-150 animate-slide-up"
                style={{ animationDelay: `${index * 0.03}s`, animationFillMode: 'both' }}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 font-mono">
                  {sale.receiptNo}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {new Date(sale.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  ${sale.grandTotal.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    sale.status === 'PAID' ? 'bg-green-100 text-green-700' :
                    sale.status === 'REFUNDED' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {sale.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleSaleClick(sale)}
                    className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all duration-200"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Sale Details Modal */}
      <Modal
        isOpen={showSaleDetails}
        onClose={() => setShowSaleDetails(false)}
        title={`Sale Details - ${selectedSale?.receiptNo}`}
        size="lg"
      >
        {selectedSale && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Date:</strong> {new Date(selectedSale.createdAt).toLocaleString()}
              </div>
              <div>
                <strong>Status:</strong> {selectedSale.status}
              </div>
            </div>
            <div>
              <strong>Items:</strong>
              <table className="min-w-full mt-2">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedSale.items.map(item => {
                    const product = state.products.find(p => p.id === item.productId);
                    return (
                      <tr key={item.productId}>
                        <td className="px-4 py-2 text-sm">{product?.name || 'Unknown'}</td>
                        <td className="px-4 py-2 text-sm">{item.qty}</td>
                        <td className="px-4 py-2 text-sm">${item.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm">${item.discountAmount.toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm">
                          ${(item.unitPrice * item.qty - item.discountAmount).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t pt-4 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${selectedSale.subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount:</span>
                <span>-${selectedSale.discountTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>${selectedSale.taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>${selectedSale.grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Payment:</span>
                <span>
                  {selectedSale.payments.cash && `Cash: $${selectedSale.payments.cash.toFixed(2)}`}
                  {selectedSale.payments.card && `Card: $${selectedSale.payments.card.toFixed(2)}`}
                </span>
              </div>
            </div>
            {(selectedSale.status === 'PAID' || selectedSale.status === 'PARTIAL_REFUND') && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowSaleDetails(false);
                    navigate('/returns');
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Process Return
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
