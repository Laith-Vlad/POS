export type UserRole = 'Cashier' | 'Manager';

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  taxRate: number;
  cost: number;
  stockQty: number;
  active: boolean;
  shortcutKey?: number; // Ctrl + this number adds to cart (1-9, 0)
}

export interface CartItem {
  productId: string;
  qty: number;
  unitPrice: number;
  discountAmount: number;
}

export interface PaymentInfo {
  cash?: number;
  card?: number;
}

export interface Sale {
  id: string;
  receiptNo: string;
  createdAt: string;
  cashierUserId: string;
  items: CartItem[];
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  payments: PaymentInfo;
  status: 'PAID' | 'REFUNDED' | 'PARTIAL_REFUND' | 'CANCELLED' | 'PARTIAL_CANCELLED';
}

export interface Return {
  id: string;
  saleId: string;
  createdAt: string;
  managerUserId: string;
  itemsReturned: CartItem[];
  refundMethod: 'CASH' | 'CARD';
  refundTotal: number;
  note?: string;
}

export interface Shift {
  id: string;
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  startingCash: number;
  expectedCash: number;
  actualCash?: number;
  variance?: number;
  status: 'OPEN' | 'CLOSED';
}

export interface AuditLog {
  id: string;
  at: string;
  userId: string;
  action: string;
  details: string;
}

export interface InventoryEvent {
  id: string;
  at: string;
  userId: string;
  productId: string;
  type: 'SALE' | 'RETURN' | 'MANUAL_ADJUST' | 'CANCELLATION';
  qtyDelta: number;
  note?: string;
}

export interface PaymentCancellation {
  id: string;
  saleId: string;
  createdAt: string;
  managerUserId: string;
  itemsCancelled: CartItem[];
  cancellationTotal: number;
  refundMethod: 'CASH' | 'CARD';
  note?: string;
}

export interface ComboItem {
  productId: string;
  qty: number;
}

export interface Combo {
  id: string;
  name: string;
  description?: string;
  items: ComboItem[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  storeName: string;
  currency: string;
  taxEnabled: boolean;
  lowStockThreshold: number;
  managerPIN: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  storeWebsite?: string;
  returnPolicy?: string;
  receiptFooter?: string;
}

export interface AppState {
  users: User[];
  products: Product[];
  combos: Combo[];
  sales: Sale[];
  returns: Return[];
  paymentCancellations: PaymentCancellation[];
  shifts: Shift[];
  auditLogs: AuditLog[];
  inventoryEvents: InventoryEvent[];
  settings: Settings;
  currentUser: User | null;
  currentShift: Shift | null;
}
