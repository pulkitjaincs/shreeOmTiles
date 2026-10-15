# Shree Om Tiles ERP - Mobile Application 📱

> Native cross-platform mobile application engineered for field sales reps, warehouse drivers, and business owners. Built with Expo SDK, React Native, Expo Router, and native filesystem sharing.

---

## 📑 Table of Contents
1. [Key Features](#key-features)
2. [Tech Stack](#tech-stack)
3. [App Architecture & Navigation](#app-architecture--navigation)
4. [Role-Adaptive Dashboard Engines](#role-adaptive-dashboard-engines)
5. [Native Device Integrations](#native-device-integrations)
6. [Offline Caching & Network Fallback](#offline-caching--network-fallback)
7. [Environment Configuration](#environment-configuration)
8. [Comprehensive Guide: Running & Testing on a Physical Smartphone](#comprehensive-guide-running--testing-on-a-physical-smartphone)
9. [Building a Standalone Android APK (EAS Build)](#building-a-standalone-android-apk-eas-build)

---

## ✨ Key Features

- **Dynamic Role-Switching Engine**: The home tab instantly reconfigures its UI based on who is logged in (`OWNER`, `SALESMAN`, or `DRIVER`).
- **Driver Trip Manifest & Route Navigation**: Touch-friendly card views with 1-tap phone dialing to customers, Google Maps driving navigation launch, and on-site cash/UPI collection.
- **Counter Sales Invoicing with Upfront UPI QR**: Salesmen can calculate tile boxes to sq. ft. on the go, issue tax invoices, and present high-contrast NPCI UPI QR codes directly to walk-in customers.
- **Native PDF Invoices & WhatsApp Sharing**: Download GST invoices directly to the phone's cache and open the native system sharing sheet (WhatsApp, Email, Bluetooth, AirDrop, Print).
- **Party Ledger & Statements**: Search customers, check real-time overdue amounts vs. advance store credits, and review chronological ledgers in the field.
- **Offline Resilient**: Local caching via `@react-native-async-storage/async-storage` allows drivers and salesmen to view manifests and party details even in weak warehouse signal areas.

---

## 🛠️ Tech Stack

- **Framework**: [Expo SDK 54 / 57](https://expo.dev/) (Managed Workflow)
- **Runtime**: [React Native 0.86](https://reactnative.dev/) + React 19
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based tab & modal navigation)
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
│   │   ├── _layout.tsx               # Root navigation stack & auth state gatekeeper
│   │   ├── index.tsx                 # Entry route resolving auth or login
│   │   ├── login.tsx                 # Fast mobile login screen with role test chips
│   │   └── (tabs)/
│   │       ├── _layout.tsx           # Role-aware bottom tab bar with dynamic tab visibility
│   │       ├── index.tsx             # Home dashboard delegating to role-specific views
│   │       ├── invoices.tsx          # Invoices list, creation modal, PDF viewer & returns
│   │       ├── transactions.tsx      # Payment receipts, collection logs, settlements
│   │       ├── stock.tsx             # Warehouse inventory search, box/sqft calculator
│   │       ├── deliveries.tsx        # Driver routes, dispatch tracking, vehicle allocation
│   │       └── more.tsx              # Party directory, statements, profile, and theme
│   │
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── DriverDashboardView.tsx    # High-contrast on-road delivery card manifest
│   │   │   ├── SalesmanDashboardView.tsx  # Fast counter billing & customer search
│   │   │   └── OwnerDashboardView.tsx     # Executive financial stats & settlement reviews
│   │   ├── deliveries/               # Push delivery modals, driver assigners
│   │   ├── invoices/                 # CreateInvoiceModal, InvoiceDetailsModal, ReturnInvoiceModal
│   │   ├── parties/                  # PartyStatementDrawer, party list cards
│   │   ├── payments/                 # Collect payment modals, mode filters
│   │   └── ui/                       # Buttons, badges, input sheets, dialogs
│   │
│   └── lib/
│       ├── api.ts                    # Dynamic backend URL resolver & offline caching
│       ├── pdf.ts                    # Native PDF downloader & system share trigger
│       └── utils.ts                  # Currency formatting & mathematical rounders
│
├── app.json                          # Expo configuration (bundle ID, permissions, plugins)
└── package.json
```

---

## 👥 Role-Adaptive Dashboard Engines

The root home tab `src/app/(tabs)/index.tsx` dynamically evaluates the logged-in user's role and renders one of three dedicated dashboard architectures:

### 1. `DriverDashboardView` (For Drivers)
- Displays only active assigned delivery runs for the driver's vehicle.
- Oversized status cards (`ASSIGNED` ➔ `IN_TRANSIT` ➔ `DELIVERED`).
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
- Business health snapshot (Today's Sales, Month-to-Date Collections, Total Receivables).
- Prominent **Pending Delivery Settlements** notification banner with quick review modal.
- Recent sales and dispatch feeds.

---

## 📲 Native Device Integrations

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

---

## 🌐 Offline Caching & Network Fallback

In `src/lib/api.ts`:
- **Android Emulator**: Automatically rewrites `localhost` to `10.0.2.2:3001`.
- **iOS Simulator**: Connects directly to `http://localhost:3001`.
- **Physical Phone**: Reads `EXPO_PUBLIC_API_URL` set to the host machine's LAN IP (e.g., `http://192.168.1.15:3001`).

---

## ⚙️ Environment Configuration

Edit `mobile-app/.env`:

```env
# Point to your PC's local Wi-Fi IP address when running on a physical phone:
EXPO_PUBLIC_API_URL=http://192.168.1.15:3001
```

---

## 📱 Comprehensive Guide: Running & Testing on a Physical Smartphone

Follow these step-by-step instructions to load and test the app on your physical iPhone or Android phone.

### Step 1: Install Expo Go on your Phone
- **Android**: Open Google Play Store and install **Expo Go**.
- **iOS**: Open Apple App Store and install **Expo Go**.

---

### Step 2: Ensure Phone & PC are on the Same Wi-Fi Network
Make sure your smartphone and your development computer are connected to the **exact same Wi-Fi router / network**.

---

### Step 3: Find your PC's Local IP Address
Open PowerShell or Command Prompt on your computer and run:
```powershell
ipconfig
```
Look for **IPv4 Address** under your active Wi-Fi adapter (e.g. `192.168.1.15`).

---

### Step 4: Configure the Mobile App Environment
In `mobile-app/.env`, set the backend URL using your computer's IP address:
```env
EXPO_PUBLIC_API_URL=http://192.168.1.15:3001
```
*(Replace `192.168.1.15` with your actual IPv4 address from Step 3).*

> **Important Windows Firewall Note**: Windows Defender Firewall might block incoming connections on port `3001`. If the app fails to connect:
> Run this once in PowerShell as Administrator:
> ```powershell
> New-NetFirewallRule -DisplayName "DhraERP Backend 3001" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
> ```

---

### Step 5: Start the Backend & Mobile Metro Bundler

1. In one terminal, start the backend:
   ```bash
   cd backend
   npm run start:dev
   ```

2. In another terminal, start the Expo Metro server:
   ```bash
   cd mobile-app
   npx expo start -c
   ```
   *(The `-c` flag clears the cache to ensure the new IP in `.env` is loaded).*

---

### Step 6: Connect your Phone

- **Android**:
  1. Open the **Expo Go** app on your phone.
  2. Tap **"Scan QR code"**.
  3. Scan the large QR code displayed in your terminal.
- **iOS**:
  1. Open the default iOS **Camera app**.
  2. Point the camera at the terminal QR code.
  3. Tap the yellow banner that says **"Open in Expo Go"**.

The JavaScript bundle will stream to your phone, and you will see the login screen!

---

### 🌐 Alternative: Tunnel Mode (If Wi-Fi Isolation is Enabled)
If your Wi-Fi router has client isolation enabled (common on corporate, hotel, or college Wi-Fi) and your phone cannot reach your PC's local IP:

Run Metro in tunnel mode:
```bash
npx expo start --tunnel
```
*Expo will generate an ngrok cloud tunnel that works anywhere in the world, even on mobile 4G/5G data.*

---

## 📦 Building a Standalone Android APK (EAS Build)

To generate an installable `.apk` file that does not require Expo Go:

1. Log in to your Expo account:
   ```bash
   npx eas login
   ```
   *(Or `npx eas-cli login`)*

2. Configure the build profile (already configured in [eas.json](file:///d:/code/Projects/dhraERP/mobile-app/eas.json)):
   ```json
   {
     "build": {
       "preview": {
         "distribution": "internal",
         "android": {
           "buildType": "apk"
         },
         "env": {
           "EXPO_PUBLIC_API_URL": "http://192.168.1.8:3001"
         }
       }
     }
   }
   ```

3. Trigger cloud APK build:
   ```bash
   npx eas build -p android --profile preview
   ```
   *EAS will compile the Android APK in the cloud and provide a direct download link and QR code to install on any Android phone.*
