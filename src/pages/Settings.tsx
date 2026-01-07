import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { showToast } from '../utils/toast';
import { clearState } from '../utils/storage';
import { exportToExcel, importProductsFromExcel, generateProductTemplate, ExportOptions } from '../utils/excel';

export default function Settings() {
  const { state, dispatch } = useApp();
  const [settings, setSettings] = useState(state.settings);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    products: true,
    sales: false,
    returns: false,
    inventory: false,
    settings: false,
  });

  const handleSaveSettings = () => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
    showToast('Settings saved', 'success');
  };

  const handleResetData = () => {
    if (window.confirm('Are you sure you want to reset all data? This will clear all sales, products, and settings.')) {
      clearState();
      dispatch({ type: 'RESET_DATA' });
      showToast('Data reset successfully', 'success');
      // Reload page to reinitialize
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const handleExportData = () => {
    setShowExportModal(true);
  };

  const handleConfirmExport = () => {
    try {
      exportToExcel(state, exportOptions);
      showToast('Data exported to Excel successfully', 'success');
      setShowExportModal(false);
    } catch (error) {
      showToast('Error exporting data', 'error');
    }
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pos-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Data exported to JSON successfully', 'success');
  };

  const handleImportData = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        // Validate data structure
        if (data.products && data.sales && data.settings) {
          dispatch({ type: 'INIT_STATE', payload: data });
          showToast('Data imported successfully', 'success');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showToast('Invalid data file', 'error');
        }
      } catch (error) {
        showToast('Error reading file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleImportExcel = () => {
    excelFileInputRef.current?.click();
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const products = await importProductsFromExcel(file);
      
      // Check for duplicates
      const duplicates = products.filter(p => 
        state.products.some(existing => existing.sku === p.sku || existing.barcode === p.barcode)
      );

      if (duplicates.length > 0) {
        const shouldContinue = window.confirm(
          `${duplicates.length} product(s) have duplicate SKU or Barcode. They will be skipped. Continue?`
        );
        if (!shouldContinue) {
          e.target.value = '';
          return;
        }
      }

      // Add products that don't have duplicates
      let addedCount = 0;
      products.forEach(product => {
        const isDuplicate = state.products.some(
          existing => existing.sku === product.sku || existing.barcode === product.barcode
        );
        if (!isDuplicate) {
          dispatch({ type: 'ADD_PRODUCT', payload: product });
          addedCount++;
        }
      });

      showToast(`Successfully imported ${addedCount} product(s)`, 'success');
      if (duplicates.length > 0) {
        showToast(`${duplicates.length} product(s) skipped due to duplicates`, 'info');
      }
    } catch (error) {
      showToast(`Import error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
    e.target.value = ''; // Reset input
  };

  const handleDownloadTemplate = () => {
    try {
      generateProductTemplate();
      showToast('Template downloaded successfully', 'success');
    } catch (error) {
      showToast('Error generating template', 'error');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
          Settings
        </h1>
        <p className="text-sm text-gray-500">Configure store settings and manage data</p>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft p-4 lg:p-8 space-y-6 lg:space-y-8 border border-gray-200/50">
        <div>
          <h2 className="text-lg font-semibold mb-4">Store Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Store Name</label>
              <input
                type="text"
                value={settings.storeName}
                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Store Address</label>
              <input
                type="text"
                value={settings.storeAddress || ''}
                onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="123 Main Street, City, State ZIP"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="text"
                  value={settings.storePhone || ''}
                  onChange={(e) => setSettings({ ...settings, storePhone: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={settings.storeEmail || ''}
                  onChange={(e) => setSettings({ ...settings, storeEmail: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="info@store.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Website</label>
              <input
                type="text"
                value={settings.storeWebsite || ''}
                onChange={(e) => setSettings({ ...settings, storeWebsite: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="www.store.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Return Policy</label>
              <textarea
                value={settings.returnPolicy || ''}
                onChange={(e) => setSettings({ ...settings, returnPolicy: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows={2}
                placeholder="Returns accepted within 30 days with receipt..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Receipt Footer Message</label>
              <input
                type="text"
                value={settings.receiptFooter || ''}
                onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="Thank you for shopping with us!"
              />
              <p className="text-xs text-gray-500 mt-1">
                Common options: "Thank you for shopping with us!", "We appreciate your business!", "Please come again!"
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <input
                type="text"
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Tax & Inventory</h2>
          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.taxEnabled}
                onChange={(e) => setSettings({ ...settings, taxEnabled: e.target.checked })}
                className="mr-2"
              />
              Enable Tax
            </label>
            <div>
              <label className="block text-sm font-medium mb-1">Low Stock Threshold</label>
              <input
                type="number"
                value={settings.lowStockThreshold}
                onChange={(e) => setSettings({ ...settings, lowStockThreshold: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded"
                min="0"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Security</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Manager PIN</label>
            <input
              type="password"
              value={settings.managerPIN}
              onChange={(e) => setSettings({ ...settings, managerPIN: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="Default: 9999"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <button
            onClick={handleSaveSettings}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Save Settings
          </button>
        </div>

        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold mb-4">Data Management</h2>
          <div className="space-y-6">
            {/* Excel Import/Export */}
            <div>
              <h3 className="text-md font-medium mb-3 text-gray-700">Excel Import/Export</h3>
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 mb-3">
                    <strong>Import Products from Excel:</strong> Download the template below, fill in your products, then import.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleDownloadTemplate}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 text-sm font-medium"
                    >
                      📥 Download Excel Template
                    </button>
                    <button
                      onClick={handleImportExcel}
                      className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 text-sm font-medium"
                    >
                      📤 Import Products (Excel)
                    </button>
                    <input
                      ref={excelFileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleExportData}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 text-sm font-medium"
                  >
                    📊 Export to Excel
                  </button>
                </div>
              </div>
            </div>

            {/* JSON Import/Export */}
            <div>
              <h3 className="text-md font-medium mb-3 text-gray-700">JSON Import/Export (Full Backup)</h3>
              <div className="flex gap-3">
                <button
                  onClick={handleExportJSON}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 text-sm font-medium"
                >
                  Export Data (JSON)
                </button>
                <button
                  onClick={handleImportData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 text-sm font-medium"
                >
                  Import Data (JSON)
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
            <div>
              <button
                onClick={handleResetData}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Reset Demo Data
              </button>
              <p className="text-sm text-gray-600 mt-2">
                This will clear all data and reload with dummy data.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold mb-4">Audit Logs</h2>
          <div className="max-h-64 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {state.auditLogs.slice(0, 50).map(log => {
                  const user = state.users.find(u => u.id === log.userId);
                  return (
                    <tr key={log.id}>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {new Date(log.at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">{user?.username || 'Unknown'}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{log.action}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{log.details}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Export Options Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto animate-fade-in">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 transition-opacity bg-gray-900/50 backdrop-blur-sm animate-fade-in" 
              onClick={() => setShowExportModal(false)}
            />
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:w-full max-w-lg animate-scale-in">
              <div className="bg-white px-6 pt-6 pb-6 sm:p-8">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                  <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Export Options
                  </h3>
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-all duration-200"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">Select what to export:</p>
                  <div className="space-y-3">
                    <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportOptions.products !== false}
                        onChange={(e) => setExportOptions({ ...exportOptions, products: e.target.checked })}
                        className="mr-3 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Products ({state.products.length})</span>
                    </label>
                    <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportOptions.sales || false}
                        onChange={(e) => setExportOptions({ ...exportOptions, sales: e.target.checked })}
                        className="mr-3 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Sales ({state.sales.length})</span>
                    </label>
                    <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportOptions.returns || false}
                        onChange={(e) => setExportOptions({ ...exportOptions, returns: e.target.checked })}
                        className="mr-3 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Returns ({state.returns.length})</span>
                    </label>
                    <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportOptions.inventory || false}
                        onChange={(e) => setExportOptions({ ...exportOptions, inventory: e.target.checked })}
                        className="mr-3 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Inventory Events ({state.inventoryEvents.length})</span>
                    </label>
                    <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportOptions.settings || false}
                        onChange={(e) => setExportOptions({ ...exportOptions, settings: e.target.checked })}
                        className="mr-3 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Settings</span>
                    </label>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setShowExportModal(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmExport}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                    >
                      Export to Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
