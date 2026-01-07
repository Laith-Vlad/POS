import * as XLSX from 'xlsx';
import { Product, AppState } from '../types';

export interface ExportOptions {
  products?: boolean;
  sales?: boolean;
  returns?: boolean;
  inventory?: boolean;
  settings?: boolean;
}

export function generateProductTemplate() {
  const templateData = [
    {
      'Name': 'Example Product',
      'SKU': 'SKU-001',
      'Barcode': 'BAR000001',
      'Category': 'Electronics',
      'Price': 99.99,
      'Tax Rate (0-1)': 0.08,
      'Cost': 50.00,
      'Stock Qty': 100,
      'Active (true/false)': true
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products Template');
  
  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, // Name
    { wch: 15 }, // SKU
    { wch: 15 }, // Barcode
    { wch: 15 }, // Category
    { wch: 12 }, // Price
    { wch: 15 }, // Tax Rate
    { wch: 12 }, // Cost
    { wch: 12 }, // Stock Qty
    { wch: 20 }, // Active
  ];

  XLSX.writeFile(wb, 'product-import-template.xlsx');
}

export function exportToExcel(state: AppState, options: ExportOptions) {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toISOString().split('T')[0];

  if (options.products !== false) {
    const productsData = state.products.map(p => ({
      'Name': p.name,
      'SKU': p.sku,
      'Barcode': p.barcode,
      'Category': p.category,
      'Price': p.price,
      'Tax Rate': p.taxRate,
      'Cost': p.cost,
      'Stock Qty': p.stockQty,
      'Active': p.active,
    }));
    const ws = XLSX.utils.json_to_sheet(productsData);
    ws['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
  }

  if (options.sales) {
    const salesData = state.sales.map(s => ({
      'Receipt No': s.receiptNo,
      'Date': new Date(s.createdAt).toLocaleString(),
      'Cashier': state.users.find(u => u.id === s.cashierUserId)?.username || 'Unknown',
      'Subtotal': s.subTotal,
      'Discount': s.discountTotal,
      'Tax': s.taxTotal,
      'Total': s.grandTotal,
      'Payment Method': s.payments.cash ? 'Cash' : 'Card',
      'Status': s.status,
      'Items Count': s.items.length,
    }));
    const ws = XLSX.utils.json_to_sheet(salesData);
    ws['!cols'] = [
      { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  }

  if (options.returns) {
    const returnsData = state.returns.map(r => ({
      'Return ID': r.id,
      'Sale Receipt No': state.sales.find(s => s.id === r.saleId)?.receiptNo || 'N/A',
      'Date': new Date(r.createdAt).toLocaleString(),
      'Manager': state.users.find(u => u.id === r.managerUserId)?.username || 'Unknown',
      'Refund Total': r.refundTotal,
      'Refund Method': r.refundMethod,
      'Note': r.note || '',
    }));
    const ws = XLSX.utils.json_to_sheet(returnsData);
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Returns');
  }

  if (options.inventory) {
    const inventoryData = state.inventoryEvents.map(e => ({
      'Date': new Date(e.at).toLocaleString(),
      'User': state.users.find(u => u.id === e.userId)?.username || 'Unknown',
      'Product': state.products.find(p => p.id === e.productId)?.name || 'Unknown',
      'Type': e.type,
      'Qty Change': e.qtyDelta,
      'Note': e.note || '',
    }));
    const ws = XLSX.utils.json_to_sheet(inventoryData);
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory Events');
  }

  if (options.settings) {
    const settingsData = [{
      'Store Name': state.settings.storeName,
      'Currency': state.settings.currency,
      'Tax Enabled': state.settings.taxEnabled,
      'Low Stock Threshold': state.settings.lowStockThreshold,
      'Manager PIN': '***', // Don't export PIN
    }];
    const ws = XLSX.utils.json_to_sheet(settingsData);
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Settings');
  }

  XLSX.writeFile(wb, `pos-export-${dateStr}.xlsx`);
}

export function importProductsFromExcel(file: File): Promise<Product[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const products: Product[] = jsonData.map((row: any, index: number) => {
          const name = row['Name'] || row['name'] || '';
          const sku = row['SKU'] || row['sku'] || `SKU-${Date.now()}-${index}`;
          const barcode = row['Barcode'] || row['barcode'] || `BAR${String(Date.now()).padStart(6, '0')}${index}`;
          const category = row['Category'] || row['category'] || 'Uncategorized';
          const price = parseFloat(row['Price'] || row['price'] || 0);
          const taxRate = parseFloat(row['Tax Rate (0-1)'] || row['Tax Rate'] || row['taxRate'] || 0);
          const cost = parseFloat(row['Cost'] || row['cost'] || 0);
          const stockQty = parseInt(row['Stock Qty'] || row['stockQty'] || 0);
          const active = row['Active (true/false)'] !== undefined 
            ? row['Active (true/false)']
            : row['Active'] !== undefined
            ? row['Active']
            : row['active'] !== undefined
            ? row['active']
            : true;

          if (!name || price <= 0) {
            throw new Error(`Row ${index + 2}: Invalid product data (Name and Price are required)`);
          }

          return {
            id: `prod-${Date.now()}-${index}`,
            name,
            sku,
            barcode,
            category,
            price,
            taxRate: Math.min(Math.max(taxRate, 0), 1), // Clamp between 0 and 1
            cost,
            stockQty: Math.max(stockQty, 0),
            active: Boolean(active),
          };
        });

        resolve(products);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
