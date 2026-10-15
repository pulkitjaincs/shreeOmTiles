# Shree Om Tiles ERP - Web Dashboard 💻

> Responsive, enterprise web management portal engineered for Shree Om Tiles administrative, sales, logistics, and counter operations. Built with Next.js 16.3.1 (App Router + Turbopack), React 19, Tailwind CSS v4, and Lucide icons.

---

## 📑 Table of Contents
1. [Key Features](#key-features)
2. [Tech Stack](#tech-stack)
3. [Project Structure & App Router Pages](#project-structure--app-router-pages)
4. [Role-Adaptive Dashboard Layouts](#role-adaptive-dashboard-layouts)
5. [Key Components & Functionality](#key-components--functionality)
6. [Design System & Theme Provider](#design-system--theme-provider)
7. [Environment Variables](#environment-variables)
8. [Local Development & Production Build](#local-development--production-build)

---

## ✨ Key Features

- **Blazing Fast Turbopack Engine**: Instant Hot Module Replacement (HMR) and optimized compilation powered by Next.js 16.3.1 Turbopack.
- **Dynamic Role-Based Views**: Automatically mounts specialized layouts for `OWNER`, `SALESMAN`, and `DRIVER` with tailored toolsets.
- **B2B Billing with Upfront Dynamic UPI QR**: Create multi-item tile invoices, calculate box-to-square-feet conversions in real time, and immediately display an on-screen NPCI UPI QR code modal for counter payments.
- **Double-Entry Party Statement Ledgers**: Comprehensive customer and supplier registries with live Net Due vs. Store Credit calculation, running balance ledgers, and 1-click printable PDF statement generation.
- **Logistics & Dispatch Board**: Drag-and-drop or modal-based delivery assignments with live trip tracking, driver vehicle allocation, and owner settlement approval.
- **Multi-Warehouse Stock Operations**: Multi-godown tracking, low-inventory alerts, inter-warehouse transfers, inward stock logging, and manual stock adjustments.
- **Staff & User Role Directory**: Manage team members, toggle active/inactive access, and reset passwords directly from the portal.
- **Crisp Dark & Light Mode**: Seamless dark/light theme switching with zero layout shift or hydration mismatch.

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
│       ├── page.tsx                      # Executive dashboard (KPI cards, charts, alerts)
│       ├── deliveries/
│       │   └── page.tsx                  # Logistics dispatch, vehicle assignment, settlements
│       ├── invoices/
│       │   └── page.tsx                  # Invoices list, creation modal, PDF viewer, returns
│       ├── parties/
│       │   └── page.tsx                  # Customer/supplier ledger, statements, dues
│       ├── payments/
│       │   └── page.tsx                  # Payment logs, receipting, reconciliation
│       ├── products/
│       │   └── page.tsx                  # Tile catalog, dimensions, box-sqft rates, stock
│       ├── users/
│       │   └── page.tsx                  # Employee directory, roles, active driver statuses
│       └── warehouses/
│           └── page.tsx                  # Showrooms vs godowns, stock transfers & adjustments
│
├── components/
│   ├── auth-provider.tsx                 # React Context for active user, token, and permissions
│   ├── theme-provider.tsx                # Next-themes wrapper for dark/light modes
│   ├── theme-toggle.tsx                  # Animated toggle switch for theme switching
│   ├── driver-dashboard.tsx              # Mobile-responsive web view for drivers
│   ├── salesman-dashboard.tsx            # Fast billing and customer lookup view for sales reps
│   ├── analytics/                        # Chart widgets and overdue aging tables
│   ├── deliveries/                       # Create delivery modals, driver assigners, settlements
│   ├── invoices/                         # Create invoice drawer, upfront UPI QR modal, PDF viewer
│   ├── parties/                          # Party statement drawer, ledger audit trail
│   ├── payments/                         # Payment creation modals, filter bars, customer dues
│   ├── products/                         # Product modal, stock adjustment drawers, inward drawers
│   ├── warehouses/                       # Warehouse forms, transfer modals
│   └── ui/                               # Accessible buttons, input fields, modals, and sheets
│
└── lib/
    ├── api.ts                            # Typed HTTP client with Bearer auth injection
    └── utils.ts                          # Currency (INR) formatting, date helpers
```

---

## 👥 Role-Adaptive Dashboard Layouts

When a user logs in, the `/dashboard` home automatically adapts:

1. **Owner / Admin View (`page.tsx`)**:
   - Executive revenue metrics (Today's Sales, Month-to-date Turnover, Total Receivables).
   - Pending Delivery Settlement banner with count and 1-click review.
   - Quick-action shortcuts for fast invoicing, adding parties, and inventory lookups.
   - Recent invoices and dispatch progress timeline.

2. **Salesman View (`salesman-dashboard.tsx`)**:
   - Quick billing bar with tile search, sq. ft. calculation, and customer selection.
   - Instant UPI QR popup for customers standing at the sales counter.
   - Customer balances and recent quotation/invoice history.

3. **Driver View (`driver-dashboard.tsx`)**:
   - Touch-friendly route manifest showing assigned orders.
   - Customer phone dialing trigger and Google Maps address link.
   - Cash / UPI collection input with on-site signature capture.

---

## 🔍 Key Components & Functionality

### Upfront UPI QR Modal (`components/invoices/`)
- Displayed immediately upon invoice submission when payment mode is UPI or Split.
- Shows dynamic QR code alongside invoice number, party name, and exact payable amount.
- Real-time poll or status confirmation once customer completes the transfer.

### Party Statement Drawer (`components/parties/party-statement-drawer.tsx`)
- Slide-over sheet showing complete chronological transaction ledger.
- Distinguishes **Net Overdue Debt** from **Advance / Store Credit** with explicit positive/negative coloring.
- One-click trigger to download printable PDF party statement.

### Multi-Warehouse Inventory Tracking (`components/products/`, `components/warehouses/`)
- Live breakdown of boxes and square footage across individual locations.
- Inter-godown transfer modal with source/destination warehouse stock checks.

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
