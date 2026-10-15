# Shree Om Tiles ERP (DhraERP) 🏗️📦

> **Enterprise-grade, Multi-platform Tile & Building Material Wholesale ERP**  
> Unified fullstack suite featuring real-time tile inventory, B2B sales invoicing with upfront NPCI UPI QR code generation, logistics & dispatch tracking, driver collection reconciliation, party statement ledgers, and executive analytics.

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2011-E0234E?logo=nestjs&logoColor=white)](file:///d:/code/Projects/dhraERP/backend)
[![Next.js](https://img.shields.io/badge/Web%20Dashboard-Next.js%2016-000000?logo=nextdotjs&logoColor=white)](file:///d:/code/Projects/dhraERP/web-dashboard)
[![Expo](https://img.shields.io/badge/Mobile%20App-Expo%20SDK%2054-000020?logo=expo&logoColor=white)](file:///d:/code/Projects/dhraERP/mobile-app)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%207-2D3748?logo=prisma&logoColor=white)](file:///d:/code/Projects/dhraERP/backend/prisma)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20(Neon)-4169E1?logo=postgresql&logoColor=white)](https://neon.tech)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## 📑 Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Monorepo Directory Layout](#monorepo-directory-layout)
3. [Core Business Domains](#core-business-domains)
4. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
5. [Ports & Network Topography](#ports--network-topography)
6. [Prerequisites & Dependencies](#prerequisites--dependencies)
7. [Quickstart Guide](#quickstart-guide)
8. [Seed Credentials & Demo Accounts](#seed-credentials--demo-accounts)
9. [Component Documentation Links](#component-documentation-links)

---

## 🏛️ System Architecture Overview

```mermaid
graph TD
    subgraph Client Layer
        Web["Web Dashboard (Next.js 16 + Turbopack)<br/>Port: 3000<br/>Desktop / Tablet Office Operations"]
        Mobile["Mobile App (Expo SDK 54 / React Native 0.81)<br/>Port: 8081<br/>Owner / Salesman / Driver In-the-Field"]
    end

    subgraph API & Application Layer
        API["Backend REST API (NestJS 11 + Fastify/Express + SWC)<br/>Port: 3001<br/>JWT Auth • RBAC Guards • UPI QR Engine • PDF-Lib Engine"]
    end

    subgraph Data & Persistence Layer
        DB[("PostgreSQL Serverless (Neon DB)<br/>Connection Pooler via @prisma/adapter-pg")]
    end

    Web -->|HTTP / JSON + Bearer JWT| API
    Mobile -->|HTTP / JSON + Bearer JWT| API
    API -->|Prisma 7 Client| DB
```

---

## 📁 Monorepo Directory Layout

```
dhraERP/
├── backend/                  # NestJS 11 core REST API & microservices
│   ├── prisma/               # Prisma 7 schema definitions & seed scripts
│   ├── src/
│   │   ├── analytics/        # Business intelligence & overdue aging reports
│   │   ├── auth/             # Passport JWT auth, hashing & RBAC guards
│   │   ├── delivery/         # Logistics, vehicle manifest, driver settlement
│   │   ├── invoices/         # Billing engine, NPCI UPI QR & PDF generation
│   │   ├── parties/          # Customer & vendor ledgers, balance tracking
│   │   ├── payments/         # Payment collection, receipting & reconciliation
│   │   ├── prisma/           # Prisma client singleton service with Neon adapter
│   │   └── products/         # Tile inventory, dimensions, sq.ft / box conversion
│   └── README.md             # Detailed Backend documentation
│
├── web-dashboard/            # Next.js 16.3 (Turbopack, App Router) Web ERP
│   ├── app/                  # App Router pages (/dashboard, /invoices, /parties, ...)
│   ├── components/           # Reusable UI components, modals, filters & drawers
│   ├── lib/                  # API client, token management, currency formatting
│   └── README.md             # Detailed Web Dashboard documentation
│
├── mobile-app/               # Expo SDK 54 / React Native 0.81 Mobile ERP
│   ├── src/
│   │   ├── app/              # Expo Router file-based tab screens
│   │   ├── components/       # Role-specific dashboards (Owner, Salesman, Driver)
│   │   └── lib/              # Native PDF download & sharing, mobile API client
│   └── README.md             # Detailed Mobile Application documentation
│
└── README.md                 # Root Monorepo master documentation (this file)
```

---

## 💼 Core Business Domains

### 1. Tile Inventory & Unit Conversions
- Specifically engineered for tile wholesale operations where items are sold in **Boxes**, but billed/measured in **Square Feet** (`sq. ft.`).
- Automatically computes total coverage area, box counts, and per-unit pricing during quote and invoice creation.
- Live inventory decrementation on invoice issuance, with automated restock on sales returns.

### 2. Upfront NPCI Dynamic UPI QR Engine
- Built-in dynamic payment QR code generator compliant with National Payments Corporation of India (NPCI) UPI deep-link standards:
  `upi://pay?pa={UPI_ID}&pn={MERCHANT}&am={AMOUNT}&cu=INR&tn={INVOICE_NO}`
- Rendered on the fly as high-resolution PNG QR images directly into:
  - Web & Mobile Invoice creation confirmation modals.
  - Native downloadable B2B GST tax invoice PDF documents.
- Enables instant on-the-spot customer collections via PhonePe, Google Pay, Paytm, or BHIM.

### 3. Party Ledgers & Balance Math
- Complete double-entry balance tracking for trade debtors (customers) and creditors (suppliers).
- Separates **Net Pending Dues** from **Store Credit / Advance Balances**, preventing accounting confusion.
- Interactive transaction statement drawer displaying debit/credit line items, running balance, payment modes, and instant PDF statement download.

### 4. End-to-End Logistics & Driver Trip Settlements
- Three-stage delivery state machine: `PENDING` ➔ `ASSIGNED` ➔ `IN_TRANSIT` ➔ `DELIVERED`.
- Drivers log on-site customer payments (Cash / UPI) along with customer signatures/acknowledgment.
- Drivers submit shift collections back to the warehouse; Owners review and perform 1-click **Settlement Approval**, locking the cash into business ledger accounts.

### 5. Sales Returns & Credit Notes
- Full or partial line-item returns with restock controls.
- Automatically generates credit balance for the customer and logs an audit record in the party statement ledger.

---

## 🛡️ Role-Based Access Control (RBAC)

The system enforces strict permission boundaries both at the NestJS API level (`@Roles(...)` decorator + `RolesGuard`) and dynamically within client UIs:

| Feature / Domain | OWNER / ADMIN | SALESMAN | DRIVER |
|:---|:---:|:---:|:---:|
| **Analytics & Gross Margin Reports** | ✅ Full Access | ❌ Hidden | ❌ Hidden |
| **Party Ledger Management** | ✅ Full Access | ✅ View / Create | ❌ Hidden |
| **Tile Inventory & Stock Adjustments** | ✅ Full Access | 👁️ View Only | ❌ Hidden |
| **Create Invoices & Dynamic UPI QR** | ✅ Full Access | ✅ Full Access | ❌ Hidden |
| **Issue Sales Returns / Credit Notes** | ✅ Full Access | ✅ Full Access | ❌ Hidden |
| **Assign Deliveries & Vehicles** | ✅ Full Access | ❌ Hidden | ❌ Hidden |
| **Trip Manifest & Status Updates** | ✅ Full Access | ❌ Hidden | ✅ Dedicated View |
| **On-Site Payment Collection** | ✅ Full Access | ✅ Full Access | ✅ Cash & UPI |
| **Driver Settlement Approval** | ✅ Full Approval | ❌ Hidden | ❌ Hidden |

---

## 🌐 Ports & Network Topography

| Service | Environment Port | Local URL | Network / LAN Access |
|:---|:---:|:---|:---|
| **Backend API** | `3001` | `http://localhost:3001` | `http://<YOUR_PC_LAN_IP>:3001` |
| **Web Dashboard** | `3000` | `http://localhost:3000` | `http://<YOUR_PC_LAN_IP>:3000` |
| **Mobile App (Metro)** | `8081` | `http://localhost:8081` | Expo Go / QR scan via WiFi |

---

## ⚙️ Prerequisites & Dependencies

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **Package Manager**: `npm` (v10+)
- **Database**: Cloud PostgreSQL (Pre-configured with Neon Serverless Postgres pooler)
- **Mobile Development**: Expo Go app installed on Android (Play Store) or iOS (App Store)

---

## 🚀 Quickstart Guide

### 1. Clone & Set Up Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Verify environment variables in backend/.env
# PORT=3001
# DATABASE_URL="postgresql://neondb_owner:...@ep-....neon.tech/neondb?sslmode=require"
# JWT_SECRET="your-secure-jwt-secret"
# UPI_ID="9828920964@okbizaxis"
# MERCHANT_NAME="Shree Om Tiles"

# Generate Prisma Client & push schema to Neon
npx prisma generate
npx prisma db push

# (Optional) Seed initial users, products, parties, and deliveries
npx prisma db seed

# Start NestJS backend in SWC watch mode
npm run start:dev
```
*Backend will be live at `http://localhost:3001`.*

---

### 2. Set Up Web Dashboard

Open a new terminal window:

```bash
# Navigate to web dashboard directory
cd web-dashboard

# Install dependencies
npm install

# Start Next.js development server with Turbopack
npm run dev
```
*Web ERP will be live at `http://localhost:3000`.*

---

### 3. Set Up Mobile App

Open a third terminal window:

```bash
# Navigate to mobile app directory
cd mobile-app

# Install dependencies
npm install

# Start Expo Metro bundler
npx expo start
```
*Metro will boot up and display an interactive QR code.*

---

## 🔑 Seed Credentials & Demo Accounts

The database comes pre-seeded with test accounts for each role:

| Role | Mobile / Username | Password | Default Interface |
|:---|:---|:---|:---|
| **Owner / Admin** | `9828920964` | `admin123` | Full ERP Dashboard, Financial KPIs, Settlement Approvals |
| **Salesman** | `9876543211` | `sales123` | Quick Billing, Upfront UPI QR, Party Statements, Catalog |
| **Driver** | `9876543212` | `driver123` | Road Manifest, 1-Click Navigation, Cash/UPI Collection |

---

## 📖 Component Documentation Links

For deep-dive technical specs, API schemas, and component architecture, refer to:

- 🖥️ **[Backend Architecture & API Reference](file:///d:/code/Projects/dhraERP/backend/README.md)**
- 💻 **[Web Dashboard Technical Guide](file:///d:/code/Projects/dhraERP/web-dashboard/README.md)**
- 📱 **[Mobile Application & Phone Installation Guide](file:///d:/code/Projects/dhraERP/mobile-app/README.md)**
