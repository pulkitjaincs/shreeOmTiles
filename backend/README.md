# Shree Om Tiles ERP - Backend Engine ⚙️

> High-performance modular RESTful API and transaction processing engine powering Shree Om Tiles ERP. Built on NestJS 11, Prisma 7, PostgreSQL (Neon Serverless pooler), SWC, and TypeScript.

---

## 📑 Table of Contents
1. [Tech Stack & Architecture](#tech-stack--architecture)
2. [Module Architecture](#module-architecture)
3. [Prisma Data Models & Schema](#prisma-data-models--schema)
4. [Authentication & Expanded RBAC](#authentication--expanded-rbac)
5. [Core Enterprise Domains & Capabilities](#core-enterprise-domains--capabilities)
6. [Automated Push Notification Engine](#automated-push-notification-engine)
7. [Upfront NPCI Dynamic UPI QR Engine](#upfront-npci-dynamic-upi-qr-engine)
8. [Comprehensive PDF Document Generation Engine](#comprehensive-pdf-document-generation-engine)
9. [Comprehensive REST API Reference](#comprehensive-rest-api-reference)
10. [Environment Variables](#environment-variables)
11. [Setup, Database Migrations & Seeding](#setup-database-migrations--seeding)
12. [Build & Production Deployment](#build--production-deployment)

---

## 🛠️ Tech Stack & Architecture

- **Framework**: [NestJS 11](https://nestjs.com/) (modular architecture, dependency injection, global exception filters, validation pipes)
- **Compiler**: [@swc/cli & @swc/core](https://swc.rs/) (sub-500ms compilation speed and instant reload)
- **ORM**: [Prisma 7](https://www.prisma.io/) with `@prisma/adapter-pg` using `pg.Pool` connection pooling
- **Database**: [PostgreSQL (Neon Serverless)](https://neon.tech/) with pooled connections and SSL encryption
- **Push Notification Service**: Native HTTP dispatch to [Expo Push Notification Service](https://docs.expo.dev/push-notifications/overview/)
- **Validation**: `class-validator` & `class-transformer` with strict whitelist filtering and automatic type transformation
- **Security**: Passport JWT authentication, Bcrypt password hashing, role-based metadata guards, and field-level price masking for supervisors
- **PDF Generation**: `pdf-lib` for programmatic, vector-crisp B2B tax invoices, credit notes, price estimates, delivery challans, and party statements
- **QR Engine**: `qrcode` with dynamic NPCI UPI deep-link string generation

---

## 🧩 Module Architecture

```
src/
├── analytics/        # Financial KPIs, revenue curves, Day Book till cash, GST reports, aging buckets
├── auth/             # JWT strategy, login/register, password hashing, @Roles() guard
├── common/           # Decorators, filters, interceptors, and pagination DTOs
├── delivery/         # Logistics manifests, driver assignments, delivery status, cash settlement, challans
│   └── pdf/          # Delivery Challan PDF generator (without pricing details for warehouse/drivers)
├── expenses/         # Categorized operational overheads (Fuel, hamali, rent, utilities, advances)
├── invoices/         # Invoicing engine, upfront UPI QR generator, PDF generator, sales returns, deletion
│   └── pdf/          # High-precision Tax Invoice & Credit Note PDF generators
├── notifications/    # Global Expo Push notification service & event triggers
├── parties/          # Customer/supplier directories, double-entry statement ledger calculations
│   └── pdf/          # Official Party Statement ledger PDF generator with date-range filtering
├── payments/         # Payment collection, receipt numbers, customer dues, store payables
├── prisma/           # PrismaClient lifecycle management and connection pooling
├── products/         # Tile inventory catalog, box-to-sqft calculation, batching, supervisor masking
├── purchases/        # Inward procurement, vendor bills, inventory replenishment, debit notes
├── quotations/       # Price estimates, quotes, vector PDF generator, 1-click invoice conversion
│   └── pdf/          # Estimate / Quotation PDF generator
├── settings/         # Company profile, GSTIN, default UPI accounts, bank accounts
├── stock/            # Multi-warehouse stock transfers, adjustments, and zero-out
├── users/            # Employee management, roles, push token registration, password updates
└── warehouses/       # Physical warehouse and showroom inventory tracking
```

---

## 🗄️ Prisma Data Models & Schema

The database model is strictly relational and optimized for high-volume wholesale transactions:

- `User`: System accounts with roles (`OWNER`, `ADMIN`, `SALESMAN`, `DRIVER`, `ACCOUNTANT`, `SUPERVISOR`), warehouse `scope`, and registered Expo `pushToken`.
- `Party`: Customers and suppliers with GSTIN, PAN, phone, billing/shipping addresses, `category` (`RETAIL`, `CONTRACTOR`, `ARCHITECT`, `WHOLESALER`), and opening balance.
- `Product`: Tile items with size/dimensions, finish, grade, pieces per box, square feet per box, `minStockAlert`, and purchase/selling prices.
- `Warehouse` & `StockLedger`: Multi-location stock allocation tracking available quantities across individual showrooms and godowns.
- `Invoice` & `InvoiceItem`: B2B sales bills with auto-calculated subtotal, CGST, SGST, IGST, discount, separate transport charges and transport GST, round-off, and net total.
- `Quotation` & `QuotationItem`: Price estimates with valid-until dates, customer details, and 1-click conversion into active sales invoices.
- `Purchase` & `PurchaseItem`: Procurement bills from suppliers with auto-replenishment of warehouse stock and debit note generation.
- `Expense`: Categorized business overheads (`FUEL_TRANSPORT`, `LABOUR_HAMALI`, `RENT_GODOWN`, `ELECTRICITY_UTILITIES`, `SALARY_ADVANCE`, `PANTRY_REFRESHMENTS`, `MAINTENANCE_REPAIRS`, `MARKETING_SAMPLE`, `OTHER`).
- `DebitNote`: Procurement return records referencing original purchases with credit ledger adjustment.
- `Payment`: Direct or invoice-linked payment receipts with mode (`CASH`, `UPI`, `CREDIT`, `BANK_TRANSFER`).
- `Delivery` & `DeliveryTrip`: Logistics manifests linking invoices to drivers, vehicles, multi-warehouse item pickup verification, and collection receipts.
- `RefundInvoice` & `RefundInvoiceItem`: Credit note records referencing original invoices with optional inventory replenishment.
- `CompanySetting` & `UpiAccount`: Company profile, GSTIN, and dynamic UPI payment accounts with primary account toggle.

---

## 🔐 Authentication & Expanded RBAC

All protected endpoints require a valid JWT Bearer token in the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

Role-based access is enforced via the custom `@Roles(...)` decorator and `RolesGuard`:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
@Get('financial-endpoint')
```

### Roles Hierarchy & Permissions

1. `OWNER`: Unrestricted access across company finances, profit margins, employee roles, settings, UPI configurations, invoice deletion, and driver cash settlement approvals.
2. `ADMIN`: Full operational access across parties, billing, stock inward/transfers, procurement, driver manifests, and delivery management.
3. `ACCOUNTANT`: Full financial visibility into the **Day Book**, Invoices, Quotations, Inward Purchases, Debit Notes, Expenses, Ledger Statements, and GSTR-1/GSTR-3B tax analytics.
4. `SUPERVISOR`: Warehouse godown supervisor. Bound to their assigned warehouse via `user.scope`:
   - Dedicated warehouse cockpit with strictly **masked pricing** (cannot see cost, rates, selling prices, or profit margins).
   - **Warehouse Pickup Verification**: Inspects items during driver loading and confirms item pickups. Drivers cannot mark items picked—supervisors must verify and lock them.
   - Stock adjustments and transfers restricted exclusively to their assigned godown.
   - Access to unpriced **Delivery Challan PDFs** (price-inclusive Tax Invoices are blocked).
5. `SALESMAN`: Counter billing, quotations/estimates, party ledgers, instant upfront UPI QR generation, payment collection, and sales returns.
6. `DRIVER`: Dedicated road cockpit for assigned delivery runs, route navigation, and on-site cash/UPI collection.

---

## 💼 Core Enterprise Domains & Capabilities

### 1. Inward Purchases & Procurement (`/purchases`)
- Manage vendor purchase orders with sequential numbering (`PUR-2627-0001`).
- Multi-warehouse stock allocation automatically increments product inventory upon purchase creation.
- Record Debit Notes (`DN-2627-0001`) against purchases for supplier returns or rate adjustments, automatically updating supplier balances.

### 2. Price Estimates & Quotations (`/quotations`)
- Generate formal quotations (`EST-2627-0001`) with expiration dates, item discounts, transport costs, and GST breakdowns.
- 1-click **Convert to Invoice** (`POST /quotations/:id/convert-to-invoice`) creates an active tax invoice and seamlessly transitions stock allocations without re-entering data.
- Generates clean, branded Estimate PDFs for customer delivery.

### 3. Business Expenses Tracker (`/expenses`)
- Record daily cash and digital overheads across categorized buckets.
- Directly reconciled against the daily cash counter inside the Day Book.

### 4. Daily Till Book / Day Book (`/analytics/day-book`)
- Real-time daily cash reconciliation:
  - **Opening Cash in Hand** brought forward from previous days.
  - **Cash Inflows** (Cash billing & customer payments).
  - **Cash Outflows** (Vendor payments & cash expenses).
  - **Digital Inflows** (UPI and Bank Transfers tracked separately).
  - **Net Cash Flow** and verified **Closing Till Balance**.
- Itemized chronological stream of all transactions for any chosen calendar date.

### 5. Automated GST Analytics (`/analytics/gst-reports`)
- **GSTR-1**: Automatic categorization of sales into B2B (with buyer GSTIN) and B2C, complete with taxable values and CGST/SGST/IGST breakdown.
- **GSTR-3B**: Outward taxable supplies, inward purchases with Input Tax Credit (ITC) eligibility, and net tax payable calculation.

### 6. Safe Transactional Invoice Deletion (`DELETE /invoices/:id`)
- Restricted strictly to `OWNER` and `ADMIN`.
- Atomically restores deducted inventory to the respective warehouse using row-level locks (`SELECT ... FOR UPDATE`).
- Deletes associated delivery orders, trips, unconfirmed payments, and credit ledger entries within a single ACID transaction.
- Comprehensive immutable audit trail logged to `AuditLog`.

### 7. Transactional Invoice Editing & Inventory Reallocation (`PUT /invoices/:id`)
- Allows authorized staff (`OWNER`, `ADMIN`, `SALESMAN`, `ACCOUNTANT`) to modify existing invoices while preserving the original invoice sequence number (`INV-2627-XXXX`).
- **Two-Phase Inventory Sync**: Reverts previously deducted stock back to source warehouses, verifies stock sufficiency for updated quantities, and deducts updated items with row-level pessimistic locks (`SELECT ... FOR UPDATE`).
- **Payment & Ledger Synchronicity**: Automatically recalculates subtotals, GST breakdown, transport charges, and round-offs. Adjusts outstanding customer ledger dues and updates linked payment records.
- **Auditing**: Records an immutable audit log entry detailing who made the modification, the invoice number, and previous values.

### 8. Cash Sale (Counter Pickup) & Logistics Separation
- B2C walk-in sales flagged with `isCashSale: true` capture optional customer name and phone without mandatory master ledger creation.
- **Logistics Segregation**: Cash sales are automatically excluded from the pending delivery dispatch manifest queue (`/delivery`), preventing counter pickups from polluting the transport dispatch board.
- **Per-Bill Custom Delivery Address**: Supports custom site/shipping address (`Invoice.address`) on both regular party bills and counter sales, rendering dynamically on PDFs and dispatch challans.

---

## 🔔 Automated Push Notification Engine

The `@Global()` `NotificationsModule` provides real-time event dispatching to mobile devices using Expo's push notification architecture:

```
[Business Action] ➔ [NotificationsService] ➔ [Expo Push Service] ➔ [Target Device]
```

| Trigger | Recipient | Title & Content | Extra Payload Data |
|:---|:---|:---|:---|
| **Invoice Creation** | `OWNER`, `ADMIN` | `New Invoice Created: INV-2026-XXXX`<br/>`₹14,500 billed to Patel Traders` | `{ type: 'INVOICE_CREATED', invoiceId }` |
| **Payment Recorded** | `OWNER`, `ADMIN` | `Payment Collected: ₹5,000`<br/>`Mode: UPI from Rajasthan Builders` | `{ type: 'PAYMENT_RECEIVED', paymentId }` |
| **Credit Note Issued** | `OWNER`, `ADMIN` | `Credit Note Issued`<br/>`₹2,400 refunded for INV-2026-XXXX (Patel Traders)` | `{ type: 'CREDIT_NOTE', invoiceId }` |
| **Low Stock Threshold** | `OWNER`, `ADMIN` | `Low Stock Alert`<br/>`Product 600x600 Marfil is below threshold (4 boxes left)` | `{ type: 'LOW_STOCK', productId }` |
| **Delivery Run Assigned** | Target Driver | `New Delivery Assigned`<br/>`Invoice INV-2026-XXXX to Sharma Construction` | `{ type: 'DELIVERY_ASSIGNED', deliveryOrderId }` |
| **Delivery In-Transit** | `OWNER`, `ADMIN` | `Trip In-Transit`<br/>`Ramesh (Driver) started delivery for INV-2026-XXXX` | `{ type: 'TRIP_IN_TRANSIT', deliveryOrderId }` |
| **Delivery Completed** | `OWNER`, `ADMIN` | `Delivery Completed`<br/>`INV-2026-XXXX delivered to Sharma Construction` | `{ type: 'DELIVERY_COMPLETED', deliveryOrderId }` |
| **Delivery Cancelled** | `OWNER`, `ADMIN` | `Delivery Cancelled`<br/>`INV-2026-XXXX cancelled. Reason: Customer unavailable` | `{ type: 'DELIVERY_CANCELLED', deliveryOrderId }` |

---

## ⚡ Upfront NPCI Dynamic UPI QR Engine

To streamline instant counter payments and delivery collections without physical POS hardware, the backend dynamically generates NPCI-compliant UPI deep links:

```
upi://pay?pa=9828920964@okbizaxis&pn=Shree%20Om%20Tiles&am=12500.00&cu=INR&tn=INV-2026-0042
```

- When an invoice is created, the backend returns both the raw `upiUrl` and a base64 Data URL QR code (`qrCodeDataUrl`).
- When a customer scans with Google Pay, PhonePe, Paytm, or BHIM:
  - Payee VPA is locked.
  - Merchant name is verified.
  - Exact invoice amount is pre-filled.
  - Invoice number is injected into transaction notes for zero-reconciliation errors.

---

## 📄 Comprehensive PDF Document Generation Engine

Built with `pdf-lib` for pixel-perfect, vector-sharp PDF generation:

1. **B2B GST Tax Invoice (`GET /invoices/:id/pdf`)**:
   - Company header, GSTIN, PAN, party billing/shipping credentials, HSN breakdown, transport cost, CGST/SGST/IGST, previous balance brought forward, and embedded UPI QR code.
2. **Sales Return / Credit Note Voucher (`GET /invoices/refund/:refundId/pdf`)**:
   - Official credit note voucher with reference to original invoice and restocking audit.
3. **Price Estimate / Quotation (`GET /quotations/:id/pdf`)**:
   - Branded formal estimate with valid-until date, itemized rates, discounts, and terms.
4. **Delivery Challan (`GET /delivery/:id/challan-pdf`)**:
   - Logistics document for transport vehicles and warehouse supervisors showing items, quantities, box/sq.ft metrics, driver sign-offs, and **zero price details**.
5. **Party Statement Ledger (`GET /parties/:id/statement-pdf`)**:
   - Full date-filtered ledger statement displaying opening balance, invoices, payments, credit notes, running balances, and net closing balance.

---

## 📡 Comprehensive REST API Reference

### 1. Authentication (`/auth`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `POST` | `/auth/login` | Authenticate with mobile/username and password | Public |
| `GET` | `/auth/me` | Fetch active user profile from JWT payload | Any Authenticated |

### 2. User & Staff Management (`/users`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/users` | List staff members with optional role and status filters | OWNER, ADMIN |
| `POST` | `/users` | Create a new user account with role and warehouse scope | OWNER |
| `PATCH` | `/users/:id` | Update staff profile details and warehouse scope | OWNER |
| `PATCH` | `/users/profile/password` | Update logged-in user password | Any Authenticated |
| `PATCH` | `/users/profile/push-token`| Register Expo push notification token | Any Authenticated |
| `PATCH` | `/users/:id/password` | Reset staff member password | OWNER |
| `PATCH` | `/users/:id/status` | Activate or deactivate staff member | OWNER |
| `DELETE` | `/users/:id` | Delete staff account | OWNER |

### 3. Invoices & Billing (`/invoices`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/invoices` | List invoices with status, date, and party filters | Any Authenticated |
| `POST` | `/invoices` | Create invoice, deduct stock, generate upfront UPI QR | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `GET` | `/invoices/:id` | Fetch complete invoice details (price-masked for supervisors) | Any Authenticated |
| `PUT` | `/invoices/:id` | Full transactional update of existing invoice & inventory reallocation | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `PATCH` | `/invoices/:id` | Partial update / modification of invoice | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `GET` | `/invoices/:id/pdf` | Stream generated binary PDF tax invoice (blocked for supervisors) | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `POST` | `/invoices/:id/return` | Process full/partial sales return and restock items | OWNER, ADMIN, SALESMAN |
| `DELETE` | `/invoices/:id` | Atomically delete invoice, restore stock, and clean ledger | OWNER, ADMIN |

### 4. Price Estimates & Quotations (`/quotations`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `POST` | `/quotations` | Create a new formal price estimate | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `GET` | `/quotations` | List quotations with search and pagination | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `GET` | `/quotations/:id` | Retrieve quotation details and line items | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `GET` | `/quotations/:id/pdf` | Stream downloadable quotation / estimate PDF | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `POST` | `/quotations/:id/convert-to-invoice` | Convert estimate directly into a live tax invoice | OWNER, ADMIN, SALESMAN, ACCOUNTANT |

### 5. Procurement & Purchases (`/purchases`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `POST` | `/purchases` | Create vendor purchase bill and increment warehouse stock | OWNER, ADMIN, ACCOUNTANT |
| `GET` | `/purchases` | List purchases with supplier and pagination filters | OWNER, ADMIN, ACCOUNTANT, SUPERVISOR |
| `GET` | `/purchases/:id` | Fetch purchase details (price-masked for supervisors) | OWNER, ADMIN, ACCOUNTANT, SUPERVISOR |
| `POST` | `/purchases/:id/debit-note` | Issue debit note against purchase for goods returned | OWNER, ADMIN, ACCOUNTANT |

### 6. Business Expenses (`/expenses`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `POST` | `/expenses` | Log business overhead expense with category and payment mode | OWNER, ADMIN, ACCOUNTANT |
| `GET` | `/expenses` | List expenses with category and date-range filters | OWNER, ADMIN, ACCOUNTANT |
| `GET` | `/expenses/:id` | Retrieve single expense record | OWNER, ADMIN, ACCOUNTANT |

### 7. Logistics & Deliveries (`/delivery`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/delivery` | List delivery manifests and runs | OWNER, ADMIN, ACCOUNTANT, SALESMAN, SUPERVISOR |
| `POST` | `/delivery` | Dispatch manifest and assign vehicle & driver (supports partial dispatch) | OWNER, ADMIN |
| `GET` | `/delivery/my-runs` | Fetch assigned trips for the logged-in driver | DRIVER |
| `GET` | `/delivery/:id` | Fetch delivery order details (masked for supervisors) | Any Authenticated |
| `GET` | `/delivery/:id/challan-pdf` | Stream unpriced official Delivery Challan PDF | Any Authenticated |
| `PATCH` | `/delivery/:id/status` | Update trip state (`IN_TRANSIT`, `DELIVERED`, `CANCELLED`) | DRIVER, OWNER, ADMIN |
| `PATCH` | `/delivery/:id/item-pickup` | Warehouse supervisor confirms and locks item pickup | OWNER, ADMIN, SUPERVISOR |
| `POST` | `/delivery/:id/collect-payment`| Record cash/UPI received by driver on delivery | DRIVER, OWNER, ADMIN |
| `POST` | `/delivery/:id/settle-approval`| Owner approves driver cash settlement | OWNER, ADMIN |

### 8. Parties & Ledgers (`/parties`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/parties` | List parties with category, search, and type filters | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `POST` | `/parties` | Register new party with GSTIN, phone, category, and address | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `GET` | `/parties/:id` | Fetch party details, balance, and recent orders | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `PATCH` | `/parties/:id` | Update party address, category, or credit details | OWNER, ADMIN, ACCOUNTANT |
| `GET` | `/parties/:id/statement` | Fetch chronological ledger JSON | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `GET` | `/parties/:id/statement-pdf` | Stream official date-filtered party statement PDF | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `DELETE` | `/parties/:id` | Delete party record | OWNER, ADMIN |

### 9. Products & Tile Catalog (`/products`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/products` | List all tile products (pricing masked for supervisors) | OWNER, ADMIN, SALESMAN, ACCOUNTANT, SUPERVISOR |
| `POST` | `/products` | Create tile SKU with box/sqft parameters & `minStockAlert` | OWNER, ADMIN, ACCOUNTANT |
| `GET` | `/products/:id` | Retrieve product details and warehouse stock | OWNER, ADMIN, SALESMAN, ACCOUNTANT, SUPERVISOR |
| `PATCH` | `/products/:id` | Update pricing, dimensions, or finish | OWNER, ADMIN, ACCOUNTANT |
| `DELETE` | `/products/:id` | Soft delete/deactivate tile product | OWNER, ADMIN |

### 10. Multi-Warehouse Stock Management (`/stock`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/stock` | Get aggregated stock balances (scoped for supervisors) | ADMIN, SALESMAN, SUPERVISOR |
| `GET` | `/stock/warehouse/:warehouseId` | Get warehouse stock breakdown (supports `?positiveOnly=true`) | ADMIN, SALESMAN, SUPERVISOR |
| `POST` | `/stock/adjust` | Record stock adjustment (strictly scoped for supervisors) | ADMIN, SUPERVISOR |
| `POST` | `/stock/transfer` | Transfer stock between physical locations (scoped origin) | ADMIN, SUPERVISOR |
| `POST` | `/stock/zero-out` | Reset stock balance for a product at godown | ADMIN, SUPERVISOR |

### 11. Warehouses & Locations (`/warehouses`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/warehouses` | List all physical warehouse and showroom locations | ADMIN, SALESMAN, SUPERVISOR, ACCOUNTANT |
| `POST` | `/warehouses` | Create a new warehouse / godown location | OWNER, ADMIN |
| `GET` | `/warehouses/:id` | Retrieve warehouse details and inventory items | ADMIN, SALESMAN, SUPERVISOR |
| `PATCH` | `/warehouses/:id` | Update warehouse name, location, or contact | OWNER, ADMIN |
| `DELETE` | `/warehouses/:id` | Delete warehouse location | OWNER, ADMIN |

### 12. Payments & Settlements (`/payments`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/payments` | List all logged payments and settlements | OWNER, ADMIN, ACCOUNTANT |
| `POST` | `/payments` | Record customer or vendor payment with reference # | OWNER, ADMIN, SALESMAN, ACCOUNTANT |
| `GET` | `/payments/party/:partyId` | List transaction history for a specific party | Any Authenticated |

### 13. Company Settings & UPI Accounts (`/settings`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/settings` | Fetch company profile, GSTIN, and active UPI accounts | Any Authenticated |
| `PATCH` | `/settings/upi` | Update default UPI ID and merchant name | OWNER |
| `POST` | `/settings/upi-accounts` | Add an additional UPI bank account | OWNER |
| `DELETE` | `/settings/upi-accounts/:id`| Remove a secondary UPI account | OWNER |
| `PATCH` | `/settings/upi-accounts/:id/primary`| Set an account as primary payment receiver | OWNER |

### 14. Analytics, Day Book & GST Reports (`/analytics`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/analytics/overview` | Fetch daily/monthly revenue, net dues, gross margin | OWNER, ADMIN, ACCOUNTANT |
| `GET` | `/analytics/aging-report` | Overdue aging analysis (0-30, 31-60, 61-90, 90+ days) | OWNER, ADMIN, ACCOUNTANT |
| `GET` | `/analytics/top-products` | Top selling tiles by square feet and turnover | OWNER, ADMIN, ACCOUNTANT |
| `GET` | `/analytics/day-book` | Comprehensive daily till reconciliation and cash stream | OWNER, ADMIN, ACCOUNTANT |
| `GET` | `/analytics/gst-reports` | Automated GSTR-1 (B2B/B2C) and GSTR-3B monthly tax summary | OWNER, ADMIN, ACCOUNTANT |

---

## ⚙️ Environment Variables

Configure `backend/.env`:

```env
# Application Port
PORT=3001

# Neon PostgreSQL Connection URL with SSL enabled
DATABASE_URL="postgresql://neondb_owner:npg_g0hZ5UqVjRsk@ep-steep-wildflower-a1y4k7qg-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# JWT Secret for Bearer Token generation
JWT_SECRET="shree_om_tiles_super_secure_jwt_token_2026_xyz"

# UPI Merchant Config for Dynamic QR Generation
UPI_ID="9828920964@okbizaxis"
MERCHANT_NAME="Shree Om Tiles"

# Logging & Environment
NODE_ENV="development"
```

---

## 🚀 Setup, Database Migrations & Seeding

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client bindings
npx prisma generate

# 3. Synchronize database schema with Neon PostgreSQL
npx prisma db push

# 4. Start development server in watch mode with SWC
npm run start:dev
```

---

## 🏗️ Build & Production Deployment

```bash
# Build with Nest CLI (SWC compiler)
npm run build

# Run production bundle with memory limit optimization
npm run start:prod
```
