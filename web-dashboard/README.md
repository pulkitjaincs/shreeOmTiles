# Shree Om Tiles ERP - Web Dashboard 💻

> Responsive, enterprise web management portal engineered for Shree Om Tiles administrative, sales, logistics, accounting, and godown warehouse operations. Built with Next.js 16.3.1 (App Router + Turbopack), React 19, Tailwind CSS v4, and Lucide icons.

---

## 📑 Table of Contents
1. [Key Features](#key-features)
2. [Tech Stack](#tech-stack)
3. [Project Structure & App Router Pages](#project-structure--app-router-pages)
4. [Role-Adaptive Dashboard Layouts & Cockpits](#role-adaptive-dashboard-layouts--cockpits)
5. [Key Components & Enterprise Workflows](#key-components--enterprise-workflows)
6. [Design System & Theme Provider](#design-system--theme-provider)
7. [Environment Variables](#environment-variables)
8. [Local Development & Production Build](#local-development--production-build)

---

## ✨ Key Features

- **Blazing Fast Turbopack Engine**: Instant Hot Module Replacement (HMR) and optimized compilation powered by Next.js 16.3.1 Turbopack.
- **Dynamic Role-Based Cockpits**: Automatically adapts navigation and screens for `OWNER`, `ADMIN`, `ACCOUNTANT`, `SUPERVISOR`, `SALESMAN`, and `DRIVER`.
- **Daily Till Book (Day Book)**: Real-time cash till reconciliation displaying opening cash, cash in/out, business expenses, digital payments (UPI/Bank), and closing balance with calendar date switching.
- **Vendor Purchases & Inward Stock**: Record supplier invoices (`PUR-2627-0001`), calculate taxes and transport, automatically increment godown stock, and generate Debit Notes.
- **Price Estimates & 1-Click Invoicing**: Create formal quotations (`EST-2627-0001`), preview/download branded estimate PDFs, and convert them to live tax invoices with a single click.
- **Business Expenses Management**: Track daily overheads across standardized categories (fuel, hamali, rent, utilities, advances) with cash vs. digital breakdown.
- **Warehouse Supervisor Cockpit**: Dedicated interface for godown supervisors with **price-masked inventory**, godown-scoped stock adjustments, and multi-warehouse loading verification.
- **Delivery Challan & Dispatch System**: Stream unpriced official Delivery Challans for transport and drivers, with support for partial quantity dispatching.
- **Safe Transactional Invoice Deletion**: Owner/Admin modal allowing verified invoice deletion with atomic row-level locked inventory restoration.
- **Double-Entry Party Statement Ledgers**: Comprehensive customer and supplier registries with live Net Due vs. Store Credit, date-filtered chronological transaction statements, and 1-click printable PDF exports.
- **Staff Roster & Scope Assignment**: Manage staff, assign roles (`ACCOUNTANT`, `SUPERVISOR`), and bind supervisors to their specific physical warehouse.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16.3.1](https://nextjs.org/) (App Router, Server & Client Components, Turbopack)
- **Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + `@tailwindcss/postcss`
- **Icons**: [Lucide React](https://lucide.dev/)
- **State & Theming**: React Context + `next-themes`
- **Utilities**: `clsx`, `tailwind-merge`, `class-variance-authority`
- **Linting**: ESLint 9 with Next.js flat configuration

---

## 📁 Project Structure & App Router Pages

```
web-dashboard/
├── app/
│   ├── globals.css                       # Tailwind v4 theme definitions and CSS variables
│   ├── layout.tsx                        # Root layout wrapping AuthProvider and ThemeProvider
│   ├── page.tsx                          # Auth redirect gateway
│   ├── login/
│   │   └── page.tsx                      # Login screen with role-aware redirection
│   └── dashboard/
│       ├── layout.tsx                    # Persistent sidebar, header, role badge, user menu
│       ├── page.tsx                      # Adaptive dashboard (Owner KPIs / Salesman / Driver / Supervisor)
│       ├── day-book/
│       │   └── page.tsx                  # Daily till reconciliation, cash flow & chronological audit
│       ├── deliveries/
│       │   └── page.tsx                  # Logistics dispatch, vehicle assignment, challans, settlements
│       ├── expenses/
│       │   └── page.tsx                  # Business expenses, categorization, and cash outflow tracking
│       ├── invoices/
│       │   └── page.tsx                  # Invoices list, creation modal, PDF viewer, deletion, returns
│       ├── parties/
│       │   └── page.tsx                  # Customer/supplier ledger, statements, category filters
│       ├── payments/
│       │   └── page.tsx                  # Payment logs, receipting, reconciliation
│       ├── products/
│       │   └── page.tsx                  # Tile catalog, dimensions, box-sqft rates, min stock alerts
│       ├── purchases/
│       │   └── page.tsx                  # Procurement bills, vendor management, debit notes
│       ├── quotations/
│       │   └── page.tsx                  # Estimates list, PDF export, 1-click invoice conversion
│       ├── users/
│       │   └── page.tsx                  # Employee directory, roles, supervisor warehouse scopes
│       └── warehouses/
│           └── page.tsx                  # Showrooms vs godowns, stock transfers & adjustments
│
├── components/
│   ├── auth-provider.tsx                 # React Context for active user, token, and permissions
│   ├── theme-provider.tsx                # Next-themes wrapper for dark/light modes
│   ├── theme-toggle.tsx                  # Animated toggle switch for theme switching
│   ├── driver-dashboard.tsx              # Mobile-responsive web view for drivers
│   ├── salesman-dashboard.tsx            # Fast billing and customer lookup view for sales reps
│   ├── supervisor-dashboard.tsx          # Godown supervisor cockpit with masked pricing & loading checks
│   ├── analytics/                        # Chart widgets, revenue curves, and overdue aging tables
│   ├── deliveries/                       # Delivery manifests, push modal (split dispatch), challans
│   ├── expenses/                         # Create expense modal with categories
│   ├── invoices/                         # Create invoice drawer, delete modal, UPI QR modal, PDF viewer
│   ├── parties/                          # Party statement drawer with date filters, ledger audit trail
│   ├── payments/                         # Payment creation modals, filter bars, customer dues
│   ├── products/                         # Product modal, stock adjustment drawers, inward drawers
│   ├── purchases/                        # Create purchase modal, vendor bill input, debit note forms
│   ├── quotations/                       # Create quotation modal, 1-click invoice converter
│   ├── warehouses/                       # Warehouse forms, transfer modals
│   └── ui/                               # Accessible buttons, input fields, modals, and sheets
│
└── lib/
    ├── api.ts                            # Typed HTTP client with Bearer auth injection
    └── utils.ts                          # Currency (INR) formatting, date helpers
```

---

## 👥 Role-Adaptive Dashboard Layouts & Cockpits

When a user logs in, the `/dashboard` home automatically mounts the designated cockpit:

1. **Owner / Admin View (`page.tsx`)**:
   - Executive financial KPIs (Today's Sales, Month-to-date Turnover, Total Receivables).
   - Pending Delivery Settlement notification banner with count and 1-click review.
   - Quick-action shortcuts for fast invoicing, adding parties, day book review, and inventory lookups.
   - Recent invoices and dispatch progress timeline.

2. **Supervisor Cockpit (`supervisor-dashboard.tsx`)**:
   - Dedicated for warehouse godown supervisors.
   - Shows active deliveries requiring items from the supervisor's scoped warehouse.
   - In-line confirmation of item pickups during loading.
   - Godown stock balance overview with **all pricing, costs, and margins strictly masked**.

3. **Accountant View**:
   - Comprehensive access to the **Day Book**, Invoices, Purchases, Debit Notes, Expenses, Ledger Statements, and GSTR Tax Reports.

4. **Salesman View (`salesman-dashboard.tsx`)**:
   - Quick billing bar with tile search, sq. ft. calculation, and customer selection.
   - Instant UPI QR popup for customers standing at the sales counter.
   - Customer balances and quotation creation shortcuts.

5. **Driver View (`driver-dashboard.tsx`)**:
   - Touch-friendly route manifest showing assigned orders.
   - Customer phone dialing trigger and Google Maps address link.
   - Cash / UPI collection input with on-site signature capture.

---

## 🔍 Key Components & Enterprise Workflows

### 1. Daily Till Book (`app/dashboard/day-book/page.tsx`)
- Interactive date picker to inspect any day's financial activity.
- Visual summary cards: **Opening Cash**, **Cash Inflow**, **Cash Outflow**, **Expenses (Cash)**, **Net Till Cash Flow**, and **Closing Till Balance**.
- Digital payments section highlighting UPI and Direct Bank Transfers.
- Tabbed chronological ledger tracking payments, expenses, and purchases.

### 2. Price Estimates & 1-Click Invoicing (`components/quotations/`)
- Draft formal estimates with customer info, product lines, discounts, transport charges, and tax.
- Generate and download vector PDF quotes on demand.
- 1-click **Convert to Invoice** button instantly turns the quote into an active GST invoice, transferring line items automatically.

### 3. Procurement & Inward Purchases (`components/purchases/`)
- Record vendor bills with PO numbers, tax rates, and transport overheads.
- Automatic inventory replenishment into selected warehouses.
- Generate **Debit Notes** directly against supplier bills with ledger balance deduction.

### 4. Safe Invoice Deletion Modal (`components/invoices/delete-invoice-modal.tsx`)
- Triggered by Owner or Admin from the invoice details drawer.
- Prompts for confirmation and warns about automatic stock restocking.
- If the order has already been physically delivered, requires explicit confirmation before rolling back.

### 5. Official Delivery Challan (`/delivery/:id/challan-pdf`)
- 1-click printable PDF delivery challan accessible from both the Deliveries board and Invoice details.
- Includes items, packaging units, vehicle number, and signature blocks without displaying sales prices.

### 6. Party Statement Drawer (`components/parties/party-statement-drawer.tsx`)
- Slide-over sheet showing complete chronological transaction ledger.
- Date range picker (`Start Date` to `End Date`) with automatic balance-brought-forward calculation.
- 1-click button to download the official PDF Party Statement.

---

## ⚙️ Environment Variables

Create or configure `.env.local` inside `web-dashboard/`:

```env
# Backend NestJS API Endpoint (Default: port 3001)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

*Note: For testing from mobile browsers or tablets on the local network, replace `localhost` with your computer's local Wi-Fi IP address (e.g. `http://192.168.1.15:3001`).*

---

## 🚀 Local Development & Production Build

```bash
# 1. Install dependencies
npm install

# 2. Run Next.js with Turbopack (Fast dev server)
npm run dev

# 3. Lint the codebase
npm run lint

# 4. Create optimized production build
npm run build

# 5. Start production server
npm run start
```
*Web Dashboard will be available at `http://localhost:3000`.*
