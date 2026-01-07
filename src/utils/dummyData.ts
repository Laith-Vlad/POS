import { AppState, Product, Sale, User, Settings } from '../types';

const categories = ['Electronics', 'Clothing', 'Food & Beverages', 'Home & Garden', 'Sports'];

const productNames = {
  Electronics: ['Laptop', 'Mouse', 'Keyboard', 'Monitor'],
  Clothing: ['T-Shirt', 'Jeans', 'Sneakers', 'Jacket'],
  'Food & Beverages': ['Coffee', 'Chips', 'Soda', 'Candy'],
  'Home & Garden': ['Potted Plant', 'Garden Tool', 'Light Bulb', 'Batteries'],
  Sports: ['Basketball', 'Tennis Racket', 'Yoga Mat', 'Dumbbells'],
};

export function generateDummyData(): AppState {
  const users: User[] = [
    { id: '1', username: 'cashier', password: '1234', role: 'Cashier' },
    { id: '2', username: 'manager', password: '1234', role: 'Manager' },
  ];

  const products: Product[] = [];
  let productIndex = 1;

  categories.forEach((category, catIndex) => {
    const names = productNames[category as keyof typeof productNames];
    names.forEach((name, nameIndex) => {
      const price = 10 + Math.random() * 990;
      const sku = `SKU-${String(catIndex + 1).padStart(2, '0')}-${String(nameIndex + 1).padStart(3, '0')}`;
      const barcode = `BAR${String(productIndex).padStart(6, '0')}`;
      
      // Assign shortcut keys sequentially to all products (1-9, then 0, then cycle)
      // For products beyond 10, cycle through shortcuts: (productIndex - 1) % 10, where 0 maps to 0 and 1-9 map to 1-9
      const shortcutNum = ((productIndex - 1) % 10);
      const shortcutKey = shortcutNum === 0 ? 0 : shortcutNum;
      
      products.push({
        id: `prod-${productIndex}`,
        name: `${name} ${category}`,
        sku,
        barcode,
        category,
        price: Math.round(price * 100) / 100,
        taxRate: category === 'Food & Beverages' ? 0 : 0.08,
        cost: Math.round(price * 0.6 * 100) / 100,
        stockQty: Math.floor(Math.random() * 100) + 10,
        active: true,
        shortcutKey,
      });
      productIndex++;
    });
  });

  const sales: Sale[] = [];
  const now = new Date();
  let receiptCounter = 123;

  // Generate 15 historical sales
  for (let i = 0; i < 15; i++) {
    const saleDate = new Date(now);
    saleDate.setDate(saleDate.getDate() - (14 - i));
    saleDate.setHours(9 + Math.floor(Math.random() * 10));
    saleDate.setMinutes(Math.floor(Math.random() * 60));

    const itemCount = Math.floor(Math.random() * 5) + 1;
    const saleItems: Sale['items'] = [];
    let subTotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const unitPrice = product.price;
      const discountAmount = Math.random() < 0.3 ? Math.round(unitPrice * qty * 0.1 * 100) / 100 : 0;
      
      saleItems.push({
        productId: product.id,
        qty,
        unitPrice,
        discountAmount,
      });

      subTotal += unitPrice * qty - discountAmount;
    }

    const discountTotal = saleItems.reduce((sum, item) => sum + item.discountAmount, 0);
    const taxTotal = Math.round(saleItems.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId)!;
      const itemTotal = item.unitPrice * item.qty - item.discountAmount;
      return sum + itemTotal * product.taxRate;
    }, 0) * 100) / 100;
    const grandTotal = subTotal + taxTotal;

    const useCash = Math.random() > 0.4;
    const payments = useCash 
      ? { cash: grandTotal }
      : { card: grandTotal };

    sales.push({
      id: `sale-${i + 1}`,
      receiptNo: `R-2026-${String(receiptCounter++).padStart(6, '0')}`,
      createdAt: saleDate.toISOString(),
      cashierUserId: '1',
      items: saleItems,
      subTotal: Math.round(subTotal * 100) / 100,
      discountTotal: Math.round(discountTotal * 100) / 100,
      taxTotal,
      grandTotal: Math.round(grandTotal * 100) / 100,
      payments,
      status: 'PAID',
    });
  }

  const settings: Settings = {
    storeName: 'POS MVP Demo Store',
    currency: 'USD',
    taxEnabled: true,
    lowStockThreshold: 20,
    managerPIN: '9999',
    storeAddress: '123 Main Street, City, State 12345',
    storePhone: '(555) 123-4567',
    storeEmail: 'info@posmvpdemo.com',
    storeWebsite: 'www.posmvpdemo.com',
    returnPolicy: 'Returns accepted within 30 days with receipt. Items must be in original condition.',
    receiptFooter: 'Thank you for shopping with us!',
  };

  return {
    users,
    products,
    combos: [],
    sales,
    returns: [],
    paymentCancellations: [],
    shifts: [],
    auditLogs: [],
    inventoryEvents: [],
    settings,
    currentUser: null,
    currentShift: null,
  };
}

export function generateReceiptNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const counter = Math.floor(Math.random() * 1000) + 1;
  return `R-${year}-${String(counter).padStart(6, '0')}`;
}
