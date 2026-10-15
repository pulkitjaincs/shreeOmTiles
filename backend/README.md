# Shree Om Tiles ERP - Backend Engine ⚙️

> High-performance modular RESTful API and transaction processing engine powering Shree Om Tiles ERP. Built on NestJS 11, Prisma 7, PostgreSQL (Neon Serverless pooler), SWC, and TypeScript.

---

## 📑 Table of Contents
1. [Tech Stack & Architecture](#tech-stack--architecture)
2. [Module Architecture](#module-architecture)
3. [Prisma Data Models & Schema](#prisma-data-models--schema)
4. [Authentication & RBAC](#authentication--rbac)
5. [Automated Push Notification Engine](#automated-push-notification-engine)
6. [Upfront NPCI Dynamic UPI QR Engine](#upfront-npci-dynamic-upi-qr-engine)
7. [Dynamic PDF Invoice & Credit Note Engine](#dynamic-pdf-invoice--credit-note-engine)
8. [Comprehensive REST API Reference](#comprehensive-rest-api-reference)
9. [Environment Variables](#environment-variables)
10. [Setup, Database Migrations & Seeding](#setup-database-migrations--seeding)
11. [Build & Production Deployment](#build--production-deployment)

---

## 🛠️ Tech Stack & Architecture

- **Framework**: [NestJS 11](https://nestjs.com/) (modular architecture, dependency injection, global exception filters, validation pipes)
- **Compiler**: [@swc/cli & @swc/core](https://swc.rs/) (sub-500ms compilation speed and instant reload)
- **ORM**: [Prisma 7](https://www.prisma.io/) with `@prisma/adapter-pg` using `pg.Pool` connection pooling
- **Database**: [PostgreSQL (Neon Serverless)](https://neon.tech/) with pooled connections and SSL encryption
- **Push Notification Service**: Native HTTP dispatch to [Expo Push Notification Service](https://docs.expo.dev/push-notifications/overview/)
- **Validation**: `class-validator` & `class-transformer` with strict whitelist filtering and automatic type transformation
- **Security**: Passport JWT authentication, Bcrypt password hashing, role-based metadata guards
- **PDF Generation**: `pdf-lib` for programmatic, vector-crisp B2B tax invoice and credit note generation
- **QR Engine**: `qrcode` with dynamic NPCI UPI deep-link string generation

---

## 🧩 Module Architecture

```
src/
├── analytics/        # Financial KPIs, revenue curves, and overdue aging buckets
├── auth/             # JWT strategy, login/register, password hashing, @Roles() guard
├── common/           # Decorators, filters, interceptors, and pagination DTOs
├── delivery/         # Logistics manifests, driver assignments, delivery status, cash settlement
├── invoices/         # Invoicing engine, upfront UPI QR generator, PDF generator, sales returns
├── notifications/    # Global Expo Push notification service & event triggers
├── parties/          # Customer/supplier directories, double-entry statement ledger calculations
├── payments/         # Payment collection, receipt numbers, customer dues, store payables
├── prisma/           # PrismaClient lifecycle management and connection pooling
├── products/         # Tile inventory catalog, box-to-sqft calculation, batching
├── settings/         # Company profile, GSTIN, default UPI accounts, bank accounts
├── stock/            # Multi-warehouse stock transfers, adjustments, and zero-out
├── users/            # Employee management, roles, push token registration, password updates
└── warehouses/       # Physical warehouse and showroom inventory tracking
```

---

## 🗄️ Prisma Data Models & Schema

The database model is strictly relational and optimized for high-volume wholesale transactions:

- `User`: System accounts with roles (`OWNER`, `ADMIN`, `SALESMAN`, `DRIVER`) and registered Expo `pushToken`.
- `Party`: Customers and suppliers with GSTIN, PAN, phone, billing/shipping addresses, and opening balance.
- `Product`: Tile items with size/dimensions, finish, grade, pieces per box, square feet per box, and purchase/selling prices.
- `Warehouse` & `Stock`: Multi-location stock allocation tracking available quantities across individual showrooms and godowns.
- `Invoice` & `InvoiceItem`: B2B sales bills with auto-calculated subtotal, CGST, SGST, IGST, discount, round-off, and net total.
- `Payment`: Direct or invoice-linked payment receipts with mode (`CASH`, `UPI`, `CHEQUE`, `BANK_TRANSFER`, `CREDIT`).
- `DeliveryRun` & `DeliveryOrder`: Logistics manifest linking invoices to drivers, vehicles, delivery status, and collection receipts.
- `SalesReturn` & `SalesReturnItem`: Credit note records referencing original invoices with optional inventory replenishment.
- `CompanySettings` & `UpiAccount`: Company profile, GSTIN, and dynamic UPI payment accounts with primary account toggle.

---

## 🔐 Authentication & RBAC

All protected endpoints require a valid JWT Bearer token in the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

Role-based access is enforced via the custom `@Roles(...)` decorator and `RolesGuard`:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN)
@Get('admin-only-endpoint')
```

Roles hierarchy:
1. `OWNER`: Full administrative access to finances, settings, staff, UPI accounts, approvals.
2. `ADMIN`: Full operational access across parties, billing, stock inward/transfers, and delivery runs.
3. `SALESMAN`: Permissions to query parties, issue invoices, generate UPI QR, log payments, and process returns.
4. `DRIVER`: Dedicated access to assigned delivery runs, route progression, payment collection, and customer signatures.

---

## 🔔 Automated Push Notification Engine

The `@Global()` `NotificationsModule` provides real-time event dispatching to mobile devices using Expo's push notification architecture:

```
[Business Action] ➔ [NotificationsService] ➔ [Expo Push Service] ➔ [Target Device]
```

### Event Triggers & Payloads

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

## 📄 Dynamic PDF Invoice & Credit Note Engine

Using `pdf-lib`, the backend generates vectorized, print-ready B2B GST invoices on request (`GET /invoices/:id/pdf`):

- **Header**: Company branding, Shree Om Tiles trade name, GSTIN, PAN, contact info.
- **Party Details**: Billed-to and shipped-to customer credentials, state code, GST number.
- **Product Grid**: Item description, size, HSN code, box count, total sq. ft., rate per sq. ft., and taxable amount.
- **Tax Breakdown**: CGST + SGST (intra-state) or IGST (inter-state) with explicit percentage calculations.
- **Embedded NPCI UPI QR**: Embedded directly onto the bottom-left of the invoice for quick scan-to-pay.
- **Terms & Sign-off**: Standard warranty and goods return terms, authorized signature space.

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
| `GET` | `/users` | List all staff members with optional role and status filters | OWNER, ADMIN |
| `POST` | `/users` | Create a new user account with assigned role | OWNER |
| `PATCH` | `/users/:id` | Update staff profile details | OWNER |
| `PATCH` | `/users/profile/password` | Update logged-in user password | Any Authenticated |
| `PATCH` | `/users/profile/push-token`| Register Expo push notification token | Any Authenticated |
| `PATCH` | `/users/:id/password` | Reset staff member password | OWNER |
| `PATCH` | `/users/:id/status` | Activate or deactivate staff member | OWNER |
| `DELETE` | `/users/:id` | Delete staff account | OWNER |

### 3. Parties & Ledgers (`/parties`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/parties` | List parties with optional type (`CUSTOMER`/`SUPPLIER`) filter | Any Authenticated |
| `POST` | `/parties` | Register a new party with GSTIN, phone, and opening balance | OWNER, ADMIN, SALESMAN |
| `GET` | `/parties/:id` | Fetch party details, current balance, and recent orders | Any Authenticated |
| `PATCH` | `/parties/:id` | Update party address, credit limit, or phone | OWNER, ADMIN |
| `GET` | `/parties/:id/statement` | Generate comprehensive chronological debit/credit ledger | Any Authenticated |

### 4. Products & Catalog (`/products`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/products` | List all tile products, dimensions, and live stock | Any Authenticated |
| `POST` | `/products` | Create a new tile SKU with box/sqft parameters | OWNER, ADMIN |
| `GET` | `/products/:id` | Retrieve product details, price tiers, and warehouse stock | Any Authenticated |
| `PATCH` | `/products/:id` | Update pricing, dimensions, or finish | OWNER, ADMIN |
| `POST` | `/products/:id/stock-adjust` | Manually increment or decrement warehouse inventory | OWNER, ADMIN |

### 5. Multi-Warehouse Stock Management (`/stock`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/stock` | Get aggregated stock balances across warehouses | ADMIN, SALESMAN |
| `POST` | `/stock/adjust` | Record stock adjustment with reason audit | OWNER, ADMIN |
| `POST` | `/stock/transfer` | Transfer stock between physical warehouses/showrooms | OWNER, ADMIN |
| `POST` | `/stock/zero-out` | Reset stock balance for a product at a specific godown | OWNER, ADMIN |

### 6. Warehouses & Locations (`/warehouses`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/warehouses` | List all physical warehouse and showroom locations | ADMIN, SALESMAN |
| `POST` | `/warehouses` | Create a new warehouse / godown location | OWNER, ADMIN |
| `GET` | `/warehouses/:id` | Retrieve warehouse details and inventory items | ADMIN, SALESMAN |
| `PATCH` | `/warehouses/:id` | Update warehouse name, location, or contact | OWNER, ADMIN |
| `DELETE` | `/warehouses/:id` | Delete warehouse location | OWNER, ADMIN |

### 7. Invoices & Billing (`/invoices`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/invoices` | List invoices with status, date, and party filters | Any Authenticated |
| `POST` | `/invoices` | Create invoice, deduct stock, generate upfront UPI QR | OWNER, ADMIN, SALESMAN |
| `GET` | `/invoices/:id` | Fetch complete invoice details, line items, and payments | Any Authenticated |
| `GET` | `/invoices/:id/pdf` | Stream generated binary PDF tax invoice | Any Authenticated |
| `POST` | `/invoices/:id/return` | Process full/partial sales return and restock items | OWNER, ADMIN, SALESMAN |

### 8. Logistics & Deliveries (`/delivery`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/delivery` | List all delivery manifests and runs | OWNER, ADMIN, SALESMAN |
| `POST` | `/delivery` | Dispatch delivery manifest and assign vehicle & driver | OWNER, ADMIN |
| `GET` | `/delivery/my-runs` | Fetch assigned trips for the logged-in driver | DRIVER |
| `PATCH` | `/delivery/:id/status` | Update trip state (`IN_TRANSIT`, `DELIVERED`, `CANCELLED`) | DRIVER, OWNER, ADMIN |
| `POST` | `/delivery/:id/collect-payment`| Record cash/UPI received by driver on delivery | DRIVER, OWNER, ADMIN |
| `POST` | `/delivery/:id/settle-approval`| Owner approves driver cash settlement | OWNER, ADMIN |

### 9. Payments & Settlements (`/payments`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/payments` | List all logged payments and settlements | OWNER, ADMIN, SALESMAN |
| `POST` | `/payments` | Record customer or vendor payment with reference # | OWNER, ADMIN, SALESMAN |
| `GET` | `/payments/party/:partyId` | List transaction history for a specific party | Any Authenticated |

### 10. Company Settings & UPI Accounts (`/settings`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/settings` | Fetch company profile, GSTIN, and active UPI accounts | Any Authenticated |
| `PATCH` | `/settings/upi` | Update default UPI ID and merchant name | OWNER |
| `POST` | `/settings/upi-accounts` | Add an additional UPI bank account | OWNER |
| `DELETE` | `/settings/upi-accounts/:id`| Remove a secondary UPI account | OWNER |
| `PATCH` | `/settings/upi-accounts/:id/primary`| Set an account as primary payment receiver | OWNER |

### 11. Analytics & Reports (`/analytics`)
| Method | Endpoint | Description | Role Required |
|:---|:---|:---|:---|
| `GET` | `/analytics/overview` | Fetch daily/monthly revenue, net dues, gross margin | OWNER, ADMIN |
| `GET` | `/analytics/aging-report` | Overdue aging analysis (0-30, 31-60, 61-90, 90+ days) | OWNER, ADMIN |
| `GET` | `/analytics/top-products` | Top selling tiles by square feet and turnover | OWNER, ADMIN |

---

## ⚙️ Environment Variables

Create or configure `backend/.env`:

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

# 4. (Optional) Run seed script to populate test data
npx prisma db seed

# 5. Start development server in watch mode with SWC
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
