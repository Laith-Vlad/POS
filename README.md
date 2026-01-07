# POS MVP Demo

A front-end only Point of Sale (POS) MVP demonstration application built with React, TypeScript, and Vite. This demo showcases a complete POS workflow end-to-end: **catalog → cart → checkout → receipt → returns → shift/day close → reports**.

## General Requirements

- **App name**: "POS MVP Demo"
- **Front-end only**: No API calls. Uses in-memory store + localStorage persistence
- **Routing**: `/login`, `/pos`, `/products`, `/inventory`, `/reports`, `/settings`, `/returns`, `/payment-history`, `/combos`
- **Responsive**: Works on 1366x768 and tablets
- **State Management**: Context API + useReducer (minimal dependencies)
- **Dummy Data**: Seeded dataset on first load (products, users, sales)
- **Reset Functionality**: Button in Settings to clear localStorage and re-seed dummy data
- **Role-Based Access**: Cashier vs Manager with different permissions
- **Audit Logging**: Tracks all sensitive actions (discount, void, return, shift close)
- **Reusable Components**: Clear folder structure with shared components

## Demo Credentials

### Cashier
- **Username**: `cashier`
- **Password**: `1234`
- **Role**: Cashier (can process sales, open shifts)

### Manager
- **Username**: `manager`
- **Password**: `1234`
- **Role**: Manager (full access)
- **Default PIN**: `9999` (can be changed in Settings)

## Setup Instructions

### Prerequisites
- Node.js (v20.19.0 or >=22.12.0 recommended)
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Preview production build:**
   ```bash
   npm run preview
   ```

The application will be available at `http://localhost:5173` (or the port shown in your terminal).

## Project Structure

```
pos-mvp-demo/
├── src/
│   ├── components/        # Reusable components (Modal, Layout, ProtectedRoute, PINModal)
│   ├── context/           # State management (AppContext with useReducer)
│   ├── pages/             # Main pages (POS, Products, Reports, etc.)
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utilities (storage, dummy data, toast, excel)
│   ├── App.tsx            # Main app component with routing
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles with Tailwind
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Data Models (TypeScript Types)

### Product
```typescript
{
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
```

### CartItem
```typescript
{
  productId: string;
  qty: number;
  unitPrice: number;
  discountAmount: number;
}
```

### Sale
```typescript
{
  id: string;
  receiptNo: string; // Format: R-YYYY-XXXXXX
  createdAt: string;
  cashierUserId: string;
  items: CartItem[];
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  payments: { cash?: number; card?: number };
  status: "PAID" | "REFUNDED" | "PARTIAL_REFUND" | "CANCELLED" | "PARTIAL_CANCELLED";
}
```

### Return
```typescript
{
  id: string;
  saleId: string;
  createdAt: string;
  managerUserId: string;
  itemsReturned: CartItem[];
  refundMethod: "CASH" | "CARD";
  refundTotal: number;
  note: string;
}
```

### Shift
```typescript
{
  id: string;
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  startingCash: number;
  expectedCash: number;
  actualCash?: number;
  variance?: number;
  status: "OPEN" | "CLOSED";
}
```

### AuditLog
```typescript
{
  id: string;
  at: string;
  userId: string;
  action: string;
  details: string;
}
```

### InventoryEvent
```typescript
{
  id: string;
  at: string;
  userId: string;
  productId: string;
  type: "SALE" | "RETURN" | "MANUAL_ADJUST";
  qtyDelta: number;
  note: string;
}
```

### Combo
```typescript
{
  id: string;
  name: string;
  description?: string;
  items: ComboItem[]; // { productId: string; qty: number }
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}
```

### PaymentCancellation
```typescript
{
  id: string;
  saleId: string;
  createdAt: string;
  cancelledBy: string;
  itemsCancelled: CartItem[];
  cancellationTotal: number;
  refundMethod: "CASH" | "CARD";
  note: string;
}
```

## Core Pages & Features

### 1. `/login` - Login Page

- Simple login form with username and password
- Automatic redirect based on role if already logged in
- Demo credentials displayed on page
- Session stored in localStorage
- Logout functionality available

**Flow:**
1. Enter credentials (cashier/1234 or manager/1234)
2. Redirects to `/pos` on successful login
3. Session persists until logout

---

### 2. `/pos` - Main POS Screen

**Layout: Two-column responsive design**

#### LEFT COLUMN: Product Catalog
- **Product Search**: 
  - Search by name, SKU, or barcode
  - Keyboard shortcut: Press `/` to focus search
  - Simulates barcode scan by allowing quick input
- **Category Filters**: Dropdown to filter by product category
- **Product Grid**: 
  - Visual product cards with name, price, stock status
  - Stock badge (green/yellow/red based on quantity)
  - Shortcut key badge (Ctrl+1-9,0) displayed prominently
  - Click to add product to cart
  - Out of stock products are disabled
- **Combo Toggle**: Switch between "Products" and "Combos" view
  - Combo cards show name, description, item count, and total price
  - Click combo to add all items to cart

#### RIGHT COLUMN: Shopping Cart
- **Cart Items List**:
  - Product name and price
  - Quantity controls (+/- buttons)
  - Remove item button
  - Line discount input (amount in dollars)
  - Line total calculation
- **Cart Summary** (Sticky footer):
  - Subtotal
  - Discount total
  - Tax total (if enabled)
  - Grand total (bold, highlighted)
- **Actions**:
  - **Create Combo from Cart**: Create a new combo from current cart items
  - **Void Cart**: Requires Manager PIN approval
  - **Checkout**: Opens checkout modal (or press Ctrl+Enter)

#### Checkout Flow:
1. **Checkout Modal** opens when cart has items
2. **Payment Options**:
   - Cash: Input amount received, displays change calculation
   - Card: Direct payment
   - Split: Can split between cash and card
3. **On "Complete Sale"**:
   - Validates open shift exists
   - Creates Sale record with status "PAID"
   - Reduces inventory stockQty for each item
   - Adds InventoryEvent for each item sold
   - Generates receipt number (R-YYYY-XXXXXX)
   - Opens receipt view modal

#### Receipt View:
- **Receipt Details**:
  - Store name, address, phone, email
  - Receipt number and date/time
  - Itemized list with quantities and prices
  - Tax breakdown (per item if applicable)
  - Payment method and amount received
  - Change amount (for cash payments)
  - Professional formatting optimized for thermal printers
- **Actions**:
  - **Print (mock)**: Triggers `window.print()` for browser print dialog
  - **New Sale**: Clears cart and closes receipt, ready for next sale

#### Shift Management (POS Page):
- **Open Shift Modal**:
  - Prompts if no shift is open
  - Requires entering starting cash amount
  - Opens shift and allows sales to proceed
- **Close Shift** (Manager only):
  - Button visible when shift is open
  - Shows expected cash calculation:
    - Starting cash + cash sales - cash refunds
  - Requires Manager PIN approval
  - Input actual cash counted
  - Displays variance (difference between expected and actual)
  - Saves shift as closed

**Keyboard Shortcuts:**
- `/` - Focus product search field
- `Ctrl+Enter` - Checkout (when cart has items)
- `Ctrl+1` through `Ctrl+9`, `Ctrl+0` - Quick add product to cart (if product has assigned shortcut key)

---

### 3. `/products` - Product Management (Manager Only)

**Features:**
- **CRUD Operations**:
  - Create new products
  - Edit existing products
  - Activate/deactivate products
  - Delete functionality (soft delete via deactivation)
- **Product Fields**:
  - Name* (required)
  - SKU* (required, must be unique)
  - Barcode* (required, must be unique)
  - Category* (required)
  - Price* (required, >= 0)
  - Tax Rate* (required, 0-1)
  - Cost* (required, >= 0)
  - Stock Quantity* (required, >= 0)
  - Shortcut Key* (required, 0-9, must be unique among active products)
- **Validation**:
  - Price >= 0
  - Tax Rate between 0 and 1
  - SKU uniqueness
  - Barcode uniqueness
  - Shortcut key uniqueness (only checked for active products)
  - Auto-suggests next available shortcut key for new products
- **UI Features**:
  - Search by name, SKU, or barcode
  - Category filter
  - Pagination (10 items per page)
  - Visual indicators for active/inactive products
  - Tax rate displayed for each product

---

### 4. `/inventory` - Inventory Management (Manager Only)

**Features:**
- **Inventory List**:
  - All products with current stock quantities
  - Search by name, SKU, or barcode
  - Category filter
  - Low-stock filter (configurable threshold from Settings)
  - Pagination (10 items per page)
- **Stock Indicators**:
  - Color-coded badges (green/yellow/red) based on stock levels
  - Low-stock warning for items below threshold
- **Manual Stock Adjustment**:
  - Click "Adjust" button on any product
  - Modal opens with:
    - Current stock quantity
    - Quantity delta input (+/- amount)
    - Note field (required)
  - Creates InventoryEvent with type "MANUAL_ADJUST"
  - Updates product stockQty
  - Adds audit log entry
- **Inventory History**:
  - View history for any product
  - Shows all events (SALE, RETURN, MANUAL_ADJUST)
  - Displays date, user, type, quantity change, and note
  - Sorted by most recent first

---

### 5. `/reports` - Reports Dashboard (Manager Only)

**Dashboard Cards:**
- Today's sales total
- Last 7 days sales total
- Average basket size
- Total returns amount

**Charts:**
- **Sales by Day**: Line chart showing last 7 days of sales
- **Payment Split**: Pie chart showing cash vs card payment distribution

**Tables:**
- **Top 10 Products by Revenue**: 
  - Product name
  - Quantity sold
  - Total revenue
  - Sorted by revenue (descending)
- **Recent Sales List**:
  - Receipt number
  - Date/time
  - Cashier
  - Total amount
  - Payment method
  - Status
  - Click to view details

**Sale Details Drawer:**
- Full sale information when clicking a sale
- Itemized list with quantities and prices
- Totals breakdown
- "Process Return" button (if sale is eligible)

**Timeline Filter:**
- Filter reports by:
  - Today
  - Last 7 days
  - Last 30 days
  - Last 3 months
  - Last 6 months
  - Last year
  - Custom date range (start and end date pickers)
- All charts and tables update based on selected timeline

---

### 6. `/returns` - Returns Processing (Manager Only)

**Features:**
- **Sale Selection**:
  - List of eligible sales (PAID or PARTIAL_REFUND status)
  - Search by receipt number or date
  - Shows sale date, total, and current status
- **Return Flow**:
  1. Select a sale from the list
  2. Modal opens showing sale details
  3. Select items to return and quantities:
     - Shows remaining quantities (after any previous returns)
     - Input quantity to return for each item
     - Cannot return more than remaining quantity
  4. Refund calculation:
     - Computes refund total including tax
     - Tax calculated based on returned items' tax rates
  5. Choose refund method: Cash or Card
  6. Add optional note
  7. Process return:
     - Updates sale status to PARTIAL_REFUND or REFUNDED
     - Increases stockQty for returned items
     - Creates InventoryEvent for each returned item (type "RETURN")
     - Creates Return record
     - Adds audit log entry

**Security:**
- Requires Manager PIN approval before processing return

---

### 7. `/payment-history` - Payment History & Cancellations (Manager Only)

**Features:**
- **Sales List**:
  - All sales with receipt numbers
  - Date/time, cashier, total amount
  - Payment method (Cash/Card)
  - Status badges (Paid, Partially Cancelled, Refunded, Cancelled)
  - Cancellation amounts displayed
- **Filters**:
  - Search by receipt number or date
  - Date filter: All Time, Today, Last 7 Days, Last 30 Days, Custom Range
  - Payment method filter: All, Cash Only, Card Only
  - Status filter: All, Paid, Partially Cancelled, Refunded, Cancelled
- **Summary Cards**:
  - Total Sales
  - Total Cancelled (highlighted in red)
  - Net Sales (highlighted in green)
- **Payment Cancellation**:
  - Click "Cancel Payment" on eligible sales
  - Select items and quantities to cancel
  - Choose refund method (Cash/Card)
  - Process cancellation:
    - Creates PaymentCancellation record
    - Updates sale status
    - Increases inventory for cancelled items
    - Creates InventoryEvent for each cancelled item
    - Adds audit log entry
- **PDF Export**:
  - Professional ledger-style PDF report
  - Landscape orientation
  - Includes:
    - Store logo and information
    - Report period and generation date
    - Summary totals (Sales, Cancelled, Net, Cash/Card breakdown)
    - Detailed transaction table with:
      - Date (with time)
      - Receipt number
      - Cashier
      - Items count
      - Payment method
      - Amount (right-aligned)
      - Cancelled amount (red if > 0)
      - Running balance
    - Visual indicators:
      - Cancelled transactions (gray with strikethrough)
      - Partially cancelled (orange)
      - Cancelled amounts (red, bold)
    - Page numbers and footer on all pages
  - Filename: `Payment_History_Ledger_YYYY-MM-DD.pdf`

---

### 8. `/combos` - Combo Management (Manager Only)

**Features:**
- **Combo List**:
  - All created combos with name, description, items, and price
  - Search by name or description
  - Pagination (10 items per page)
  - Status indicators (Active/Inactive)
- **CRUD Operations**:
  - **Create**: 
    - Name* (required)
    - Description (optional)
    - Add products to combo with quantities
    - Price calculated automatically (sum of items)
    - Can also create from POS cart (cashier or manager)
  - **Edit**: Modify combo name, description, or items
  - **Activate/Deactivate**: Toggle combo availability
- **Combo Usage in POS**:
  - Switch to "Combos" view in POS
  - Click combo to add all items to cart
  - Stock validation ensures all items are available
  - Items added with their specified quantities

---

### 9. `/settings` - Settings (Manager Only)

**Store Information:**
- Store name*
- Store address
- Store phone
- Store email
- Store website

**Configuration:**
- Currency (default: USD)
- Tax enabled toggle
- Tax rate (when enabled)
- Low-stock threshold (for inventory warnings)
- Manager PIN (default: 9999, for approvals)
- Return policy text
- Receipt footer message

**Data Management:**
- **Reset Demo Data**: 
  - Clears all localStorage data
  - Re-seeds dummy data (users, products, sales, settings)
  - Confirmation prompt before reset
- **Export Data**:
  - Excel export with template
  - Choose what to export (Products, Sales, Returns, Inventory, Settings)
  - Downloads as `.xlsx` file
- **Import Data**:
  - Excel import for products
  - Download template button
  - Validates and imports products with stock updates
- **Export JSON**: Download all data as JSON file
- **Import JSON**: Upload and load JSON file

---

## Security & Controls (Front-End Simulated)

### Manager Approvals Required For:
1. **Void Cart**: Manager PIN required
2. **Excessive Discount**: Discount > 20% of subtotal requires Manager PIN
3. **Close Shift**: Manager PIN required
4. **Process Return**: Manager PIN required
5. **Payment Cancellation**: Manager PIN required

### Approval Flow:
- Modal opens requesting Manager PIN
- Validates against stored PIN in settings
- Proceeds with action on successful validation
- Logs approval action in audit log

### Audit Logging:
All sensitive actions are logged with:
- Timestamp
- User ID
- Action type
- Detailed description

**Logged Actions:**
- DISCOUNT_APPLIED (when > 20%)
- CART_VOIDED
- SHIFT_CLOSED
- PROCESS_RETURN
- PAYMENT_CANCELLATION
- INVENTORY_ADJUST
- PRODUCT_CREATED
- PRODUCT_UPDATED
- And more...

---

## Shift Management (Important)

### Opening a Shift:
- **Required to sell**: No sales can be processed without an open shift
- **Prompt**: Modal appears automatically when accessing POS without open shift
- **Starting Cash**: Must enter starting cash amount
- **Shift Record**: Creates Shift record with:
  - Opened timestamp
  - Starting cash amount
  - Opened by user ID
  - Status: "OPEN"

### Closing a Shift:
- **Manager Only**: Only managers can close shifts
- **Button**: "Close Shift" button on POS page (when shift is open)
- **Expected Cash Calculation**:
  - Starting cash
  - + All cash sales during shift
  - - All cash refunds during shift
- **Actual Cash**: Manager enters actual cash counted
- **Variance**: Calculated difference (Expected - Actual)
- **Approval**: Requires Manager PIN
- **Shift Update**: 
  - Updates Shift record with:
    - Closed timestamp
    - Actual cash
    - Variance
    - Status: "CLOSED"
  - Creates audit log entry

### Shift States:
- **OPEN**: Active shift, sales can be processed
- **CLOSED**: Shift completed, cannot process sales until new shift opened

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus product search field |
| `Ctrl+Enter` | Checkout (when cart has items) |
| `Ctrl+1` through `Ctrl+9` | Quick add product to cart (if product has assigned shortcut key) |
| `Ctrl+0` | Quick add product to cart (if product has shortcut key 0) |

**Note**: Shortcuts are disabled when:
- Typing in input fields (search, discount, etc.)
- Modal is open (checkout, receipt, shift, etc.)

---

## Workflow: End-to-End POS Flow

### Complete Sale Flow:

1. **Login** → Cashier or Manager logs in
2. **Open Shift** → Enter starting cash (required for first sale)
3. **Browse Products** → Search or use category filters
4. **Add to Cart** → Click product or use keyboard shortcut (Ctrl+1-9,0)
   - Can add individual products or combos
   - Can apply line discounts
5. **Adjust Cart** → Modify quantities, add discounts, remove items
6. **Checkout** → Click "Checkout" or press Ctrl+Enter
7. **Select Payment** → Choose Cash, Card, or Split
   - If Cash: Enter amount received, see change
8. **Complete Sale** → Click "Complete Sale"
   - Sale record created
   - Inventory updated
   - Receipt generated
9. **View Receipt** → Print or start new sale

### Return Flow:

1. **Navigate to Returns** → Manager goes to `/returns`
2. **Select Sale** → Choose from list of eligible sales
3. **Select Items** → Choose items and quantities to return
4. **Review Refund** → See calculated refund total
5. **Choose Method** → Select Cash or Card refund
6. **Manager Approval** → Enter Manager PIN
7. **Process Return** → Return processed:
   - Sale status updated
   - Inventory restored
   - Return record created

### Day End Flow:

1. **Review Sales** → Check Reports dashboard
2. **Close Shift** → Click "Close Shift" on POS page
3. **Count Cash** → Enter actual cash amount
4. **Manager Approval** → Enter Manager PIN
5. **Review Variance** → Check difference between expected and actual
6. **Close Shift** → Shift closed, sales locked until new shift opened

---

## Dummy Data

On first load, the application seeds:

- **2 Users**:
  - Cashier (cashier/1234)
  - Manager (manager/1234)
- **20 Products**:
  - Across 5 categories (Electronics, Clothing, Food & Beverages, Home & Garden, Sports)
  - Realistic prices, stock quantities
  - Barcodes (BAR000001 - BAR000020)
  - SKUs (SKU-01-001, etc.)
  - Each assigned keyboard shortcuts (Ctrl+1-9,0 cycling)
- **15 Historical Sales**:
  - Various dates and amounts
  - Mix of cash and card payments
  - Receipt numbers (R-2026-000001, etc.)
- **Empty Combos Array**: Combos can be created after login
- **Default Settings**:
  - Store name: "POS MVP Demo Store"
  - Tax enabled: false
  - Low-stock threshold: 10
  - Manager PIN: 9999

**Reset Data**: Available in Settings → "Reset Demo Data" button

---

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Chart library for reports
- **jsPDF** - PDF generation for payment history
- **xlsx** - Excel import/export functionality
- **file-saver** - File download utilities
- **Context API + useReducer** - State management (minimal dependencies)

---

## Browser Support

Works best in modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

**Tested resolutions:**
- 1366x768 (desktop)
- Tablet sizes (768px and up)

---

## Development Notes

- **State Management**: Simple Context + useReducer pattern for minimal dependencies
- **Data Persistence**: All data stored in browser localStorage
- **Receipt Format**: `R-YYYY-XXXXXX` (e.g., R-2026-000123)
- **Inventory Tracking**: Every stock change logged as InventoryEvent
- **Audit Trail**: Complete log of all sensitive actions
- **Responsive Design**: Mobile-first approach with breakpoints for tablet and desktop
- **Animations**: CSS-only animations for performance (fade-in, slide-up, scale-in)
- **Toast Notifications**: Non-intrusive notifications that don't interfere with modals

---

## Features Summary

### For Cashiers:
- ✅ Process sales with product search and keyboard shortcuts
- ✅ Create combos on-the-fly from cart items
- ✅ View and use pre-created combos
- ✅ Apply discounts to individual items
- ✅ Process payments (cash/card/split)
- ✅ Generate and print receipts
- ✅ Manage shifts (open with starting cash)
- ✅ View current shift status

### For Managers:
- ✅ All cashier features plus:
- ✅ Full product management (CRUD) with mandatory keyboard shortcuts
- ✅ Combo management (create, edit, activate/deactivate combos)
- ✅ Inventory adjustments with history tracking
- ✅ Returns processing
- ✅ Payment cancellations
- ✅ Reports and analytics dashboard with timeline filters
- ✅ Settings and data management (import/export, reset)
- ✅ Audit log viewing
- ✅ Close shifts with cash reconciliation
- ✅ Excel import/export for products
- ✅ PDF export for payment history (professional ledger format)

---

## Limitations

Since this is a **front-end only** demo:

- ❌ No backend API - all data stored in localStorage
- ❌ No real payment processing
- ❌ No multi-user concurrent access
- ❌ Data is browser-specific (not synced across devices)
- ❌ No server-side validation
- ❌ Receipt "Print" button uses browser print (window.print())
- ❌ Combos don't have custom pricing (priced as sum of items, discounts can be applied at checkout)
- ❌ No real-time inventory updates across multiple sessions
- ❌ No user authentication server (credentials stored in localStorage)

---

## License

This is a demo project for educational purposes.
