# Shree Om Tiles ERP - Mobile Application 📱

> Native cross-platform mobile application engineered for field sales reps, warehouse drivers, and business owners. Built with Expo SDK 57, React Native 0.86, React 19, Expo Router, native push notifications, and filesystem sharing.

---

## 📑 Table of Contents
1. [Key Features](#key-features)
2. [Tech Stack](#tech-stack)
3. [App Architecture & Navigation](#app-architecture--navigation)
4. [Componentized Directory Structure](#componentized-directory-structure)
5. [Role-Adaptive Dashboard Engines](#role-adaptive-dashboard-engines)
6. [Real-Time Push Notifications Infrastructure](#real-time-push-notifications-infrastructure)
7. [Native Device Integrations & WhatsApp Sharing](#native-device-integrations--whatsapp-sharing)
8. [Offline Caching & Network Fallback](#offline-caching--network-fallback)
9. [Environment Configuration](#environment-configuration)
10. [Running & Testing on a Physical Smartphone](#running--testing-on-a-physical-smartphone)
11. [Building a Standalone Android APK (EAS Build)](#building-a-standalone-android-apk-eas-build)

---

## ✨ Key Features

- **Full Parity with Web ERP**: Complete feature set matching the desktop web dashboard including billing, inventory inward/transfer, payments, customer dues, and driver manifests.
- **Dynamic Role-Adaptive Cockpit**: The home tab instantly switches between specialized dashboards for `OWNER`, `SALESMAN`, and `DRIVER`.
- **Driver Trip Manifest & Route Navigation**: Touch-friendly card views with 1-tap phone dialing to customers, Google Maps driving navigation launch, and on-site cash/UPI collection.
- **Counter Sales Invoicing with Upfront UPI QR**: Salesmen can calculate tile boxes to sq. ft. on the go, issue tax invoices, and present high-contrast NPCI UPI QR codes directly to walk-in customers.
- **Real-Time Push Notifications**: Receives instant push notifications for new invoices, payments, credit notes, low stock warnings, and delivery assignments.
- **Native PDF Invoices & WhatsApp Sharing**: Download GST invoices directly to the device and share immediately via WhatsApp, Email, Bluetooth, AirDrop, or Print.
- **Double-Entry Party Ledgers & Statements**: Search customers, check real-time overdue amounts vs. advance store credits, and review chronological ledgers in the field.
- **Multi-Warehouse Stock Management**: View live stock across godowns and showrooms, record inward stock, and execute inter-godown transfers.

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
  - `expo-sharing`: Native OS share dialog integration.
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
│   │       ├── invoices.tsx          # Invoices list, creation modal, PDF viewer & returns
│   │       ├── transactions.tsx      # Payment receipts, collection logs, settlements
│   │       ├── stock.tsx             # Warehouse inventory search, box/sqft calculator
│   │       ├── deliveries.tsx        # Driver routes, dispatch tracking, vehicle allocation
│   │       └── more.tsx              # Party directory, statements, staff, warehouses, settings
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

The mobile app has been componentized into modular domain packages:

```
src/components/
├── dashboard/
│   ├── owner/                        # ExecutiveKpiGrid, ReceivablesHealthCard, DriverCashHandoverQueue,
│   │                                 # PaymentCategoryBreakdown, RecentTransactionsStream, SalesStaffPerformance
│   ├── driver/                       # DriverActiveCockpit, DriverTopStatusCards, QueuedAssignmentsList,
│   │                                 # WarehousePickupChecklist
│   ├── salesman/                     # SalesmanDashboardView (rapid counter billing, UPI modal)
│   └── shared/                       # CategorySplitCard, DateFilterBar, SalesTimelineCard
│
├── deliveries/                       # DeliveryCard, DeliveryFilterTabs, PushDeliveryModal, PushSuccessModal
├── invoices/                         # InvoiceListCard, InvoiceListFilters, filterInvoiceList,
│                                     # InvoiceLineItemCard, CreateInvoiceModal, InvoiceDetailsModal,
│                                     # ReturnInvoiceModal, ShareInvoiceModal, CounterUpiModal,
│                                     # CustomerSelector, ActiveLocationsModal
├── parties/                          # PartiesDirectoryView, PartyCard, PartyFormModal,
│                                     # PartyStatementDrawer, CreditAgeingRow, DeletePartyModal
├── payments/                         # PaymentStatsRow, TransactionTabsBar, TransactionHistoryCard,
│                                     # CustomerDuesCard, StorePayablesCard, CreditLedgerCard,
│                                     # RecordSettlementModal, RecordCreditModal
├── settings/                         # CompanySettingsView, StaffDirectoryView, StaffCard,
│                                     # StaffFormModal, UpiAccountCard, AddUpiModal
├── stock/                            # StockTabBar, StockActionsBar, ProductCatalogCard,
│                                     # WarehouseStockCard, AddProductModal, InwardStockModal,
│                                     # StockAdjustModal, StockTransferModal
├── warehouses/                       # WarehousesDirectoryView, WarehouseCard, WarehouseDangerModals
└── ui/                               # BottomSheetModal, Header, custom Select dropdown, badges, buttons
```

---

## 👥 Role-Adaptive Dashboard Engines

The home tab `src/app/(tabs)/index.tsx` dynamically evaluates the logged-in user's role and renders one of three dedicated dashboard architectures:

### 1. `DriverDashboardView` (For Drivers)
- Active cockpit displaying only trips assigned to the driver's vehicle.
- Status cards (`ASSIGNED` ➔ `IN_TRANSIT` ➔ `DELIVERED`).
- Shortcuts to:
  - 📞 Call Customer directly via system dialer.
  - 🗺️ Open Google Maps / Apple Maps navigation to the shipping address.
  - 💵 Log Cash or UPI collection on delivery.
  - ✍️ Mark trip complete with customer signature / confirmation.

### 2. `SalesmanDashboardView` (For Sales Reps)
- Fast counter-billing layout.
- Quick search for tile designs, sizes, and stock availability.
- Dynamic box-to-square-feet rate converter.
- Upfront NPCI UPI QR code generation to present to customers at point of sale.

### 3. `OwnerDashboardView` (For Administrators)
- Executive financial KPIs (Today's Sales, Month-to-Date Collections, Total Receivables).
- Prominent **Pending Delivery Settlements** notification banner with 1-click review modal.
- Live recent transactions stream and staff performance metrics.

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

## 📲 Native Device Integrations & WhatsApp Sharing

### PDF Download & System Share (`src/lib/pdf.ts`)
```typescript
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export async function downloadAndSharePdf(invoiceId: string, invoiceNumber: string) {
  const fileUri = `${FileSystem.documentDirectory}${invoiceNumber}.pdf`;
  const downloadRes = await FileSystem.downloadAsync(
    `${API_BASE}/invoices/${invoiceId}/pdf`,
    fileUri,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  await Sharing.shareAsync(downloadRes.uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Share Invoice ${invoiceNumber}`,
    UTI: 'com.adobe.pdf',
  });
}
```

### WhatsApp Invoice Sharing (`src/lib/whatsapp.ts`)
- Prepares formatted billing summaries with invoice number, itemized totals, and deep links.
- Launches the official WhatsApp client using `Linking.openURL('whatsapp://send?phone=...&text=...')`.

---

## 🌐 Offline Caching & Network Fallback

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

### Step 1: Install Expo Go on your Phone
- **Android**: Install **Expo Go** from Google Play Store.
- **iOS**: Install **Expo Go** from Apple App Store.

### Step 2: Ensure Phone & PC are on the Same Wi-Fi Network
Make sure your smartphone and your development computer are connected to the **same Wi-Fi router**.

### Step 3: Find your PC's Local IP Address
In PowerShell run:
```powershell
ipconfig
```
Find the **IPv4 Address** under your active Wi-Fi adapter (e.g. `192.168.1.15`).

### Step 4: Configure `mobile-app/.env`
```env
EXPO_PUBLIC_API_URL=http://192.168.1.15:3001
```

> **Windows Firewall Note**: If the app fails to connect, allow port `3001` in PowerShell as Administrator:
> ```powershell
> New-NetFirewallRule -DisplayName "DhraERP Backend 3001" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
> ```

### Step 5: Start Metro Bundler
```bash
cd mobile-app
npx expo start -c
```

### Step 6: Connect your Phone
- **Android**: Open Expo Go, tap **Scan QR code**, scan the terminal QR code.
- **iOS**: Open Camera app, point at the terminal QR code, tap **Open in Expo Go**.

---

## 📦 Building a Standalone Android APK (EAS Build)

The project includes an optimized EAS build configuration in `eas.json` with `arm64-v8a` compilation:

1. Configure EAS CLI:
   ```bash
   npx eas login
   ```

2. Trigger Android Preview APK build:
   ```bash
   eas build -p android --profile preview
   ```
   *EAS will compile the Android APK in the cloud and provide a direct download link and QR code to install on any Android phone.*

- **Package**: `com.shreeomtiles.erp` (Version 1.0.0)
- **Uses Cleartext Traffic**: Enabled via `expo-build-properties` to allow local HTTP backend communication.
- **Compilation Arch**: Pinned to `arm64-v8a` to reduce C++ build times.
