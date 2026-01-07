import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, Product, Sale, Return, PaymentCancellation, Shift, AuditLog, InventoryEvent, User, Settings, Combo } from '../types';
import { loadState, saveState, loadSession } from '../utils/storage';
import { generateDummyData, generateReceiptNumber } from '../utils/dummyData';

type AppAction =
  | { type: 'INIT_STATE'; payload: AppState }
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'ADD_PRODUCT'; payload: Product }
  | { type: 'UPDATE_PRODUCT'; payload: Product }
  | { type: 'DELETE_PRODUCT'; payload: string }
  | { type: 'ADD_COMBO'; payload: Combo }
  | { type: 'UPDATE_COMBO'; payload: Combo }
  | { type: 'DELETE_COMBO'; payload: string }
  | { type: 'ADD_SALE'; payload: Sale }
  | { type: 'UPDATE_SALE'; payload: Sale }
  | { type: 'ADD_RETURN'; payload: Return }
  | { type: 'ADD_PAYMENT_CANCELLATION'; payload: PaymentCancellation }
  | { type: 'OPEN_SHIFT'; payload: Shift }
  | { type: 'CLOSE_SHIFT'; payload: Shift }
  | { type: 'ADD_AUDIT_LOG'; payload: AuditLog }
  | { type: 'ADD_INVENTORY_EVENT'; payload: InventoryEvent }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'RESET_DATA' };

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'INIT_STATE':
      // Ensure paymentCancellations and combos exist for backward compatibility
      return {
        ...action.payload,
        paymentCancellations: action.payload.paymentCancellations || [],
        combos: action.payload.combos || [],
      };
    
    case 'LOGIN':
      return { ...state, currentUser: action.payload };
    
    case 'LOGOUT':
      return { ...state, currentUser: null, currentShift: null };
    
    case 'ADD_PRODUCT':
      return { ...state, products: [...state.products, action.payload] };
    
    case 'UPDATE_PRODUCT':
      return {
        ...state,
        products: state.products.map(p => p.id === action.payload.id ? action.payload : p),
      };
    
    case 'DELETE_PRODUCT':
      return {
        ...state,
        products: state.products.map(p => p.id === action.payload ? { ...p, active: false } : p),
      };
    
    case 'ADD_COMBO':
      return { ...state, combos: [action.payload, ...state.combos] };
    
    case 'UPDATE_COMBO':
      return {
        ...state,
        combos: state.combos.map(c => c.id === action.payload.id ? action.payload : c),
      };
    
    case 'DELETE_COMBO':
      return {
        ...state,
        combos: state.combos.map(c => c.id === action.payload ? { ...c, active: false } : c),
      };
    
    case 'ADD_SALE':
      return {
        ...state,
        sales: [action.payload, ...state.sales],
        products: state.products.map(product => {
          const saleItem = action.payload.items.find(item => item.productId === product.id);
          if (saleItem) {
            return { ...product, stockQty: product.stockQty - saleItem.qty };
          }
          return product;
        }),
      };
    
    case 'UPDATE_SALE':
      return {
        ...state,
        sales: state.sales.map(s => s.id === action.payload.id ? action.payload : s),
      };
    
    case 'ADD_RETURN':
      return {
        ...state,
        returns: [action.payload, ...state.returns],
        products: state.products.map(product => {
          const returnItem = action.payload.itemsReturned.find(item => item.productId === product.id);
          if (returnItem) {
            return { ...product, stockQty: product.stockQty + returnItem.qty };
          }
          return product;
        }),
      };
    
    case 'ADD_PAYMENT_CANCELLATION':
      return {
        ...state,
        paymentCancellations: [action.payload, ...(state.paymentCancellations || [])],
        products: state.products.map(product => {
          const cancelledItem = action.payload.itemsCancelled.find(item => item.productId === product.id);
          if (cancelledItem) {
            return { ...product, stockQty: product.stockQty + cancelledItem.qty };
          }
          return product;
        }),
      };
    
    case 'OPEN_SHIFT':
      return { ...state, currentShift: action.payload, shifts: [action.payload, ...state.shifts] };
    
    case 'CLOSE_SHIFT':
      return {
        ...state,
        currentShift: null,
        shifts: state.shifts.map(s => s.id === action.payload.id ? action.payload : s),
      };
    
    case 'ADD_AUDIT_LOG':
      return { ...state, auditLogs: [action.payload, ...state.auditLogs] };
    
    case 'ADD_INVENTORY_EVENT':
      return { ...state, inventoryEvents: [action.payload, ...state.inventoryEvents] };
    
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };
    
    case 'RESET_DATA':
      const newData = generateDummyData();
      return { ...newData, currentUser: state.currentUser };
    
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, {
    users: [],
    products: [],
    combos: [],
    sales: [],
    returns: [],
    paymentCancellations: [],
    shifts: [],
    auditLogs: [],
    inventoryEvents: [],
    settings: {
      storeName: 'POS MVP Demo Store',
      currency: 'USD',
      taxEnabled: true,
      lowStockThreshold: 20,
      managerPIN: '9999',
    },
    currentUser: null,
    currentShift: null,
  });

  useEffect(() => {
    // Initialize state from localStorage or generate dummy data
    const savedState = loadState();
    if (savedState) {
      dispatch({ type: 'INIT_STATE', payload: savedState });
      // Restore session
      const session = loadSession();
      if (session) {
        const user = savedState.users.find(u => u.id === session.userId);
        if (user) {
          dispatch({ type: 'LOGIN', payload: user });
          if (session.shiftId) {
            const shift = savedState.shifts.find(s => s.id === session.shiftId && s.status === 'OPEN');
            if (shift) {
              dispatch({ type: 'OPEN_SHIFT', payload: shift });
            }
          }
        }
      }
    } else {
      const dummyData = generateDummyData();
      dispatch({ type: 'INIT_STATE', payload: dummyData });
      saveState(dummyData);
    }
  }, []);

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    if (state.products.length > 0) {
      saveState(state);
    }
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

export { generateReceiptNumber };
