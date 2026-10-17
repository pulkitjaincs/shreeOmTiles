# Shree Om Tiles ERP - Mobile Application 📱

> Native cross-platform mobile application engineered for field sales reps, warehouse drivers, godown supervisors, accountants, and business owners. Built with Expo SDK 57, React Native 0.86, React 19, Expo Router, native push notifications, and filesystem sharing.

---

## 📑 Table of Contents
1. [Key Features](#key-features)
2. [Tech Stack](#tech-stack)
3. [App Architecture & Navigation](#app-architecture--navigation)
4. [Componentized Directory Structure](#componentized-directory-structure)
5. [Role-Adaptive Dashboard Engines & Cockpits](#role-adaptive-dashboard-engines--cockpits)
6. [Daily Till Book, Procurement & Estimates](#daily-till-book-procurement--estimates)
7. [Supervisor Godown Verification & Logistics](#supervisor-godown-verification--logistics)
8. [Real-Time Push Notifications Infrastructure](#real-time-push-notifications-infrastructure)
9. [Native Document Generation & WhatsApp Sharing](#native-document-generation--whatsapp-sharing)
10. [Offline Caching & Network Configuration](#offline-caching--network-configuration)
11. [Running & Testing on a Physical Smartphone](#running--testing-on-a-physical-smartphone)
12. [Building a Standalone Android APK (EAS Build)](#building-a-standalone-android-apk-eas-build)
13. [Over-The-Air (OTA) Instant Updates (EAS Update)](#over-the-air-ota-instant-updates-eas-update)

---

## ✨ Key Features

- **Full Parity with Web ERP**: Complete feature set matching the desktop web dashboard including counter billing, vendor procurement, quotations, inventory inward/transfer, payment collection, customer dues, and driver manifests.
- **Dynamic Role-Adaptive Cockpits**: Home tab dynamically switches between specialized dashboards for `OWNER`, `SALESMAN`, `DRIVER`, and `SUPERVISOR`.
- **Integrated Transactions & Daily Till Book**: Merged cash drawer reconciliation and payment management into a unified Transactions tab (`src/app/(tabs)/transactions.tsx`) displaying opening till cash, cash in/out, expenses, digital collections, and verified closing cash with date-wise navigation.
- **Price Estimates & Mobile Quotations**: Issue formal quotations on the go (`CreateQuotationModal.tsx`), multi-tile line items with box/sq. ft. calculations, download/share branded PDFs via WhatsApp, and convert quotes to active sales invoices with a single tap.
- **Inward Purchases & Vendor Procurement**: Record incoming vendor bills on mobile (`CreatePurchaseModal.tsx`), assign destination warehouses, compute GST, and replenish inventory instantaneously.
- **Warehouse Positive-Stock Filtering**: Displays only items with quantity > 0 in warehouse stock cards (`WarehouseCard.tsx`), omitting zero-quantity records for clean inventory auditing.
- **Supervisor Loading Verification**: Dedicated godown supervisor cockpit with **price-masked inventory** to verify and lock loaded items before driver departure.
- **Logistics Delivery Challans**: 1-tap download and sharing of unpriced official Delivery Challans for drivers and warehouse dispatchers.
- **Streamlined Returns & Credit Ledgers**: Process sales returns with item-level restocking, auto-reflecting credits in party statement ledgers without obsolete duplicate return invoice PDFs.
- **Safe Transactional Invoice Deletion**: Owner/Admin modal to safely delete an invoice with automatic inventory replenishment back into the godown.
- **Counter Sales Invoicing with Upfront UPI QR**: Salesmen calculate tile boxes to sq. ft. on the go, issue tax invoices, and present high-contrast NPCI UPI QR codes directly to walk-in customers.
- **Real-Time Push Notifications**: Instant heads-up alerts for new invoices, payments, credit notes, low stock warnings, and delivery assignments.
- **Native Document Sharing & WhatsApp**: Download GST invoices, challans, quotes, and party statements directly to device storage and share via WhatsApp or print.
- **Over-The-Air (OTA) Updates**: Configured with `expo-updates` and EAS Update channels for instant code deployments without requiring a new APK compilation or store resubmission.

---

## 🛠️ Tech Stack

- **Framework**: [Expo SDK 57](https://expo.dev/) (Managed Workflow)
- **Runtime**: [React Native 0.86](https://reactnative.dev/) + React 19
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based tab & modal navigation)
- **Push Notifications**: `expo-notifications` with Android Notification Channels
- **Icons**: `@expo/vector-icons` (Ionicons, MaterialIcons, Feather)
- **Gestures & Animations**: `react-native-reanimated` + `react-native-gesture-handler`
- **Native APIs**:
  - `expo-file-system/legacy`: Low-latency binary PDF file downloads.
  - `expo-sharing`: Native OS share dialog integration (WhatsApp, AirDrop, Bluetooth, Print).
  - `expo-linking`: Direct phone call (`tel:`) and GPS map navigation (`geo:`).

---

## 📁 App Architecture & Navigation

```
mobile-app/
├── src/
│   ├── app/
│   │   ├── _layout.tsx               # Root stack, ThemeProvider, AuthProvider, Notification setup
│   │   ├── index.tsx                 # Entry route resolving auth or login
│   │   ├── login.tsx                 # Fast mobile login screen with role test chips
│   │   └── (tabs)/
│   │       ├── _layout.tsx           # Role-aware bottom tab bar with dynamic tab visibility
│   │       ├── index.tsx             # Home dashboard delegating to role-specific views
│   │       ├── invoices.tsx          # Invoices list, creation modal, PDF viewer, deletion & returns
│   │       ├── transactions.tsx      # Payment receipts, collection logs, settlements
│   │       ├── stock.tsx             # Warehouse inventory search, box/sqft calculator
│   │       ├── deliveries.tsx        # Driver routes, dispatch tracking, challans, supervisor checks
│   │       └── more.tsx              # Day Book, Quotations, Purchases, Expenses, Parties, Staff, Settings
│   │
│   ├── components/                   # Modular domain components (see breakdown below)
│   └── lib/
│       ├── api.ts                    # Dynamic backend URL resolver & offline caching
│       ├── auth-context.tsx          # Auth provider & automatic push token registration
│       ├── notifications.ts          # Expo push notifications setup & notification channels
│       ├── pdf.ts                    # Native PDF downloader & system share trigger
│       ├── utils.ts                  # Currency formatting & mathematical rounders
│       └── whatsapp.ts               # Direct WhatsApp message & invoice link trigger
│
├── app.json                          # Expo configuration (bundle ID, permissions, plugins)
├── eas.json                          # EAS build configuration (optimized arm64-v8a build)
└── package.json
```

---

## 🧩 Componentized Directory Structure

```
src/components/
├── dashboard/
│   ├── owner/                        # ExecutiveKpiGrid, ReceivablesHealthCard, DriverCashHandoverQueue
│   ├── driver/                       # DriverActiveCockpit, DriverTopStatusCards, WarehousePickupChecklist
│   ├── salesman/                     # SalesmanDashboardView (rapid counter billing, UPI modal)
│   ├── SupervisorDashboardView.tsx   # Warehouse supervisor cockpit with price masking & pickup verification
│   └── shared/                       # CategorySplitCard, DateFilterBar, SalesTimelineCard
│
├── day-book/
│   └── DayBookView.tsx               # Daily Till Book with date switching & cash stream
├── quotations/
│   ├── QuotationsView.tsx            # Estimates directory, PDF preview & 1-click invoice conversion
│   └── CreateQuotationModal.tsx      # Multi-tile line items, box/sqft calculations, taxes & transport charges
├── purchases/
│   ├── PurchasesView.tsx             # Vendor bills, inward inventory increment & debit notes
│   └── CreatePurchaseModal.tsx       # Inward procurement bill creation, party selection & instant stock restock
├── expenses/
│   ├── ExpensesView.tsx              # Categorized business expenses directory & totals
│   └── CreateExpenseModal.tsx        # Modal to log overhead expense with category and mode
│
├── deliveries/                       # DeliveryCard (with Challan button & Supervisor actions),
│                                     # PushDeliveryModal (partial dispatch), DeliveryRunModal
├── invoices/                         # InvoiceListCard, InvoiceLineItemCard, CreateInvoiceModal,
│                                     # DeleteInvoiceModal, InvoiceDetailsModal, ReturnInvoiceModal
├── parties/                          # PartiesDirectoryView, PartyCard, PartyFormModal (with categories),
│                                     # PartyStatementDrawer (with date range & PDF export)
├── payments/                         # PaymentStatsRow, TransactionTabsBar, CustomerDuesCard
├── settings/                         # CompanySettingsView, StaffDirectoryView, StaffCard,
│                                     # StaffFormModal (Accountant/Supervisor roles & warehouse scope)
├── stock/                            # StockTabBar, ProductCatalogCard, WarehouseStockCard, Inward/Transfer modals
├── warehouses/                       # WarehousesDirectoryView, WarehouseCard (positive stock > 0), WarehouseDangerModals
└── ui/                               # BottomSheetModal, Header, custom Select dropdown, badges, buttons
```

---

## 👥 Role-Adaptive Dashboard Engines & Cockpits

The home tab `src/app/(tabs)/index.tsx` dynamically evaluates the logged-in user's role and renders one of four dedicated dashboard architectures:

### 1. `SupervisorDashboardView` (For Warehouse Supervisors)
- **Scoped to Assigned Godown**: Shows active deliveries that include items originating from the supervisor's physical warehouse (`user.scope`).
- **Loading Checklist**: Inspect and confirm item pickup with a single tap. Records supervisor's identity (`pickedUpByName`) and permanently locks the state.
- **Price Masking**: Tile purchase rates, selling prices, and invoice margins are completely hidden.

### 2. `DriverDashboardView` (For Drivers)
- Active road cockpit displaying only trips assigned to the driver.
- Status cards (`ASSIGNED` ➔ `IN_TRANSIT` ➔ `DELIVERED`).
- Shortcuts to:
  - 📞 Call Customer directly via system dialer.
  - 🗺️ Open Google Maps / Apple Maps navigation to the shipping address.
  - 📋 View the **Warehouse Pickup Checklist** (awaiting supervisor confirmation).
  - 💵 Log Cash or UPI collection on delivery.
  - 📄 1-tap download of the **Delivery Challan PDF**.

### 3. `SalesmanDashboardView` (For Sales Reps)
- Fast counter-billing layout.
- Quick search for tile designs, sizes, and stock availability.
- Dynamic box-to-square-feet rate converter.
- Upfront NPCI UPI QR code generation to present to customers at point of sale.

### 4. `OwnerDashboardView` (For Administrators & Owners)
- Executive financial KPIs (Today's Sales, Month-to-Date Collections, Total Receivables).
- Prominent **Pending Delivery Settlements** notification banner with 1-click review modal.
- Live recent transactions stream and staff performance metrics.

---

## 💼 Daily Till Book, Procurement & Estimates

The `More` and `Transactions` views provide comprehensive wholesale financial tools:

- **Integrated Till Book & Transactions (`src/app/(tabs)/transactions.tsx`)**:
  - Live cash till drawer reconciliation displaying **Opening Cash**, **Cash Inflows**, **Cash Outflows**, **Daily Expenses**, and **Net Closing Cash**.
  - Digital collection stream (UPI & Bank Transfers) tracked independently.
  - Interactive calendar date toolbar to audit any historical day's till closing.
- **Price Estimates & Quotations (`QuotationsView.tsx` & `CreateQuotationModal.tsx`)**:
  - Browse existing estimates, preview quotation details, download/share PDFs.
  - Tap **New Quotation** to open full-featured creation modal with customer selection, multi-item tile picker, square feet/box converters, custom GST rates, and transport charges.
  - 1-click **Convert to Invoice** button to instantly promote estimates to active tax invoices.
- **Inward Procurement & Purchases (`PurchasesView.tsx` & `CreatePurchaseModal.tsx`)**:
  - Review purchase history, supplier bills, and debit notes.
  - Tap **New Purchase** to record incoming supplier bills directly on mobile, selecting supplier party, target warehouse, line items, and immediate stock increment.
- **Business Expenses (`ExpensesView.tsx` & `CreateExpenseModal.tsx`)**:
  - Record operational overheads on the go with standardized categories (fuel, hamali, godown rent, utilities, salary advances) with cash vs digital tracking.

---

## 🚚 Supervisor Godown Verification & Logistics

1. **Warehouse Pickup Protocol**:
   - Drivers cannot mark items as picked.
   - When a driver arrives at a godown, the warehouse supervisor inspects the stock, taps **Confirm Pick**, and locks the status with an immutable supervisor timestamp.
2. **Delivery Challan Sharing**:
   - Drivers and warehouse staff can download and share unpriced official Delivery Challans directly from the delivery card.
3. **Split Delivery Dispatch**:
   - Dispatch partial quantities for an invoice, automatically retaining remaining items in the pending queue.

---

## 🔔 Real-Time Push Notifications Infrastructure

Implemented in `src/lib/notifications.ts` and initialized in `src/app/_layout.tsx`:

1. **Automatic Token Registration**:
   - On user login, the app requests notification permissions via `expo-notifications`.
   - Obtains an Expo Push Token (`ExponentPushToken[...]`).
   - Automatically posts the token to `PATCH /users/profile/push-token`.

2. **Android Notification Channel Configuration**:
   - Creates a dedicated high-priority channel:
     ```typescript
     await Notifications.setNotificationChannelAsync('default', {
       name: 'default',
       importance: Notifications.AndroidImportance.MAX,
       vibrationPattern: [0, 250, 250, 250],
       lightColor: '#2563EB',
     });
     ```

3. **In-App & Background Notification Handling**:
   - Displays heads-up alerts with sound and vibration even when the app is foregrounded.
   - Response listeners intercept taps and route users directly to the associated invoice, payment, or delivery order.

---

## 📲 Native Document Generation & WhatsApp Sharing

### Multi-Document PDF Download & System Share (`src/lib/pdf.ts`)
```typescript
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export async function downloadAndSharePdf(endpoint: string, fileName: string) {
  const fileUri = `${FileSystem.documentDirectory}${fileName}.pdf`;
  const downloadRes = await FileSystem.downloadAsync(
    `${API_BASE}/${endpoint}`,
    fileUri,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  await Sharing.shareAsync(downloadRes.uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Share ${fileName}`,
    UTI: 'com.adobe.pdf',
  });
}
```

Supports 1-click download and share for:
- 📄 **GST Tax Invoices** (`invoices/:id/pdf`)
- 📋 **Delivery Challans** (`delivery/:id/challan-pdf`)
- 📑 **Price Estimates** (`quotations/:id/pdf`)
- 📊 **Party Statements** (`parties/:id/statement-pdf`)

---

## 🌐 Offline Caching & Network Configuration

In `src/lib/api.ts`:
- **Android Emulator**: Automatically rewrites `localhost` to `10.0.2.2:3001`.
- **iOS Simulator**: Connects directly to `http://localhost:3001`.
- **Physical Phone**: Reads `EXPO_PUBLIC_API_URL` from your local environment. Set it to a reachable backend URL for your network.

---

## ⚙️ Environment Configuration

Edit `mobile-app/.env`:

```env
# Point to your PC's local Wi-Fi IP address when running on a physical phone:
EXPO_PUBLIC_API_URL=http://<YOUR_PC_LAN_IP>:3001
```

---

## 📱 Running & Testing on a Physical Smartphone

```bash
cd mobile-app
npx expo start -c
```
*Scan the terminal QR code with Expo Go (Android) or the Camera app (iOS).*

---

## 📦 Building a Standalone Android APK (EAS Build)

The project includes an optimized EAS build configuration in `eas.json` with `arm64-v8a` compilation:

```bash
eas build -p android --profile preview
```

- **Package**: `com.shreeomtiles.erp` (Version 1.0.0)
- **Uses Cleartext Traffic**: Enabled via `expo-build-properties` to allow local HTTP backend communication.
- **Compilation Arch**: Pinned to `arm64-v8a` to reduce C++ build times.

---

## ⚡ Over-The-Air (OTA) Instant Updates (EAS Update)

The mobile application is pre-configured with `expo-updates` and EAS Update to ship hotfixes, UI improvements, and new features instantly to installed APKs and user devices without recompiling binary packages or waiting for app store reviews.

### Publishing an Update to Production

```bash
cd mobile-app
eas update --branch production --environment production --message "feat: mobile quotations, purchases, zero-stock filtering & transaction sync" --non-interactive
```

### Channel Routing & Runtime Version Policy
- **Runtime Version Policy**: Configured as `{"policy": "appVersion"}` ensuring compatibility between compiled native code and JavaScript bundles.
- **Channels**: Linked to build environments (`production`, `preview`, `development`) in `eas.json`.
- **Automatic Client Retrieval**: When the app starts, `expo-updates` checks the EAS remote endpoint (`https://u.expo.dev/...`) in the background and applies updates automatically on next launch.

