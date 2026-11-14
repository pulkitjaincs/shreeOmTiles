# dhraERP Cross-Service Architecture & Implementation Fix Plan
**Enterprise Tile & Building Material ERP — Logic, Workflow, Multi-Warehouse & Financial Ledger Reconciliation**

- **Document Version**: 2.0.0 (Production Synthesis)
- **Target Working Directory**: `d:\code\Projects\dhraERP`
- **Audit Date**: 2026-11-14
- **Safety Mode**: Strictly Read-Only (Zero Code/DB Mutations Executed)
- **Status**: Ready for Phased Engineering Execution

---

## Table of Contents
1. [Executive Summary & Cross-Service Ledger Architecture](#1-executive-summary--cross-service-ledger-architecture)
   - 1.1 Architectural Context & Systemic Failure Archetypes
   - 1.2 Cross-Service Ledger Flow & Desynchronization Patterns
2. [Comprehensive Discrepancy Catalog by Functional Domain](#2-comprehensive-discrepancy-catalog-by-functional-domain)
   - Domain 1: Invoices, Returns & Sales Workflow (ISS-01 to ISS-11)
   - Domain 2: Purchases, Vendor Bills & Debit Notes (ISS-12 to ISS-25)
   - Domain 3: Payments, Parties, Credit Ledgers & Settlements (ISS-26 to ISS-36)
   - Domain 4: Analytics, Financial Reporting, Delivery & Stock Audits (ISS-37 to ISS-48)
3. [Cross-Cutting Execution Phases & Priority Matrix](#3-cross-cutting-execution-phases--priority-matrix)
   - Phase 1: Financial Ledger, Status & Double Credit Auto-Healing (P0 - Critical)
   - Phase 2: Inventory & Multi-Warehouse Tracking Alignment (P0 - Critical)
   - Phase 3: Transaction Relations, Salesman Filtering & Debit Note Parity (P1 - High)
   - Phase 4: Analytics, GST Compliance & Delivery Synchronization (P1 - High)
   - Phase 5: Frontend UI/UX Math, Truncation & Presentation Fixes (P2 - Medium)
4. [Verification & Validation Protocol](#4-verification--validation-protocol)
   - Simulation & Testing Framework (Zero Production DB Mutation)
   - Phase-by-Phase Acceptance Test Cases

---

## 1. Executive Summary & Cross-Service Ledger Architecture

### 1.1 Architectural Context & Systemic Failure Archetypes
dhraERP is an enterprise multi-platform ERP supporting B2B and retail wholesale operations in building materials, ceramics, marble, and sanitaryware. The technology stack spans a NestJS/Prisma/PostgreSQL backend, a Next.js (Turbopack) web management dashboard, and an Expo SDK 57 React Native mobile application.

Following a comprehensive read-only audit across all 4 operational domains, **48 distinct systemic defects** were discovered. These defects are not merely isolated presentation bugs; they represent architectural fault lines where the financial double-entry ledger, multi-warehouse stock allocations, auto-healing background routines, and physical logistics desynchronize:

1. **Return Store Credit Lockout & Double Credit Phantom Inflation**:
   When customer returns generate Store Credit (`CreditType.PAYABLE`), the invoice creation engine filters them out (`refundInvoiceId: null`), forcing customers to pay bills in full while their credit is locked. Concurrently, `reconcilePartyFinancials` in the payments service misinterprets excess refund credit as unallocated advance balance and mints a duplicate `CreditLedger` row, doubling store liabilities out of thin air.
2. **Debit Note Inventory Disconnect & Supplier Credit Inversion**:
   Supplier returns (Debit Notes) fail to outward physical stock from `StockLedger`, leaving digital inventory inflated while goods have physically left the godown. In the mobile client, supplier credits generated from debit notes are summed into vendor payable dues, presenting supplier refund balances as liabilities owed to the vendor.
3. **Earmarked FIFO Payment Hijacking**:
   The payment auto-healing engine pools all customer inflow payments and reallocates them strictly FIFO to the oldest historical invoices. This strips earmarked payments from newer sales bills, flips settled deliveries back to unpaid states, and prompts delivery drivers to demand duplicate cash payments at customer job sites.
4. **Driver Cash Shortfall Debt Transference**:
   When a delivery driver collects cash but hands over a short amount due to theft or transit loss, the system applies only the collected cash to the customer invoice and automatically bills the remaining shortfall as an unpaid customer debt in `CreditLedger`.
5. **Multi-Warehouse Stock Ledger Nullification**:
   Purchase inwarding, sales returns, and return reversals bypass the destination warehouse, hardcoding `warehouseId: null` and `batchNo: null` into `StockLedger` and selecting arbitrary warehouse records updated most recently.
6. **Cash Drawer Blindspots & Salesman Transaction Filtering**:
   Standalone return cash payouts are created with `invoiceId: null`. Salesman payment queries filter strictly by `where: { invoice: { salesmanId } }`, rendering return cash disbursements invisible to sales staff and creating unreconciled drawer shortfalls.
7. **30-Minute Cache Lockup on Operational Logistics**:
   The delivery service lacks cache invalidation hooks. When cash is collected from drivers, the analytics dashboard serves stale cached data for up to 1800 seconds, creating ghost queues on executive boards.

### 1.2 Cross-Service Ledger Flow & Desynchronization Patterns
The diagram below illustrates how a single financial event ripples across services and where desynchronizations occur:

```
                  ┌───────────────────────────────┐
                  │    Customer Returns Goods     │
                  │   (Process Return / Credit)   │
                  └──────────────┬────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                 ▼                               ▼
    [invoices.service.ts]             [payments.service.ts]
    Creates CreditLedger              reconcilePartyFinancials
    - type: PAYABLE                   - Remaining Payment = Inflows - Outflows
    - refundInvoiceId: REF-001        - Finds payable ledgers WHERE refundInvoiceId IS NULL
    - status: UNPAID                  - Generates 2nd CreditLedger ("Advance Balance")
                 │                               │
                 └───────────────┬───────────────┘
                                 │
                                 ▼
                     DOUBLE CREDIT LIABILITY!
                 (Customer gets ₹2,000 + ₹2,000)
                                 │
                                 ▼
                    [Create Subsequent Invoice]
                    - Query filters WHERE refundInvoiceId IS NULL
                    - Excludes original return credit!
                    - Customer forced to pay full bill!
```

---

## 2. Comprehensive Discrepancy Catalog by Functional Domain

---

### Domain 1: Invoices, Returns & Sales Workflow (Issues ISS-01 to ISS-11)

#### ISS-01: Store Credits from Returns Excluded from Invoice Offsetting
- **Locations**:
  - Backend: `backend/src/invoices/invoices.service.ts:528–538`
  - Backend: `backend/src/payments/payments.service.ts:293–302`
  - Backend: `backend/src/parties/parties.service.ts:452–459`
  - Web: `web-dashboard/componentsWeb/invoices/create-invoice-modal.tsx:142–165`
  - Mobile: `mobile-app/src/components/invoices/CreateInvoiceModal.tsx:110–135`
- **Root Cause & Trigger Conditions**:
  When a customer returns goods and chooses Store Credit (`refundMode: CREDIT`), `invoices.service.ts:1571–1576` creates a `CreditLedger` entry with `type: CreditType.PAYABLE`, `refundInvoiceId: refundInvoice.id`. However, when creating a subsequent invoice, line 535 queries `party.id` with `refundInvoiceId: null`. Because all return store credits carry a non-null `refundInvoiceId`, the query returns empty.
- **Data Flow Breakdown**:
  1. Customer returns ₹3,000 of tiles. System issues Store Credit `CreditLedger(PAYABLE, ₹3,000, refundInvoiceId: 'REF-101')`.
  2. Customer purchases ₹5,000 of sanitaryware.
  3. `invoices.service.ts` searches for payable credits with `refundInvoiceId: null`. Found 0.
  4. Invoice is billed at full ₹5,000. Customer store credit remains locked at ₹3,000 indefinitely.
- **Proposed Fix**:
  - **Backend**: In `invoices.service.ts:535` and `payments.service.ts:299`, remove `refundInvoiceId: null`. Allow any `CreditType.PAYABLE` ledger for the party where `status !== CreditStatus.SETTLED` to offset new invoices. Mark used store credit ledgers as `SETTLED`.
  - **Web Dashboard**: In `create-invoice-modal.tsx`, fetch and display available store credits (including refund credit notes) with an explicit "Apply Store Credit" toggle.
  - **Mobile App**: In `CreateInvoiceModal.tsx`, show available customer store credit chip and auto-deduct from initial payable total.

---

#### ISS-02: Salesman Filter & Relation Omissions in Transactions (Standalone Returns Blindspot)
- **Locations**:
  - Backend: `backend/src/payments/payments.service.ts:843–846, 860–880, 1179–1182`
  - Backend: `backend/src/invoices/invoices.service.ts:1558`
  - Web: `web-dashboard/componentsWeb/payments/recent-transactions-stream.tsx:42–85`
  - Mobile: `mobile-app/src/components/payments/PaymentCard.tsx:35–60`
- **Root Cause & Trigger Conditions**:
  In standalone returns (`invoices.service.ts:1558`), `tx.payment.create` is invoked with `invoiceId: null`. When a salesman views transactions, `payments.service.ts:845` enforces `where: { invoice: { salesmanId: user.id } }`. Because `invoiceId` is null, refund payments are omitted. Furthermore, `includeRelations` omits `refundInvoice`.
- **Data Flow Breakdown**:
  1. Salesman processes a standalone cash return of ₹1,200. Cash drawer dispenses ₹1,200.
  2. Outflow payment is saved with `invoiceId: null, type: OUTFLOW`.
  3. Salesman opens Day Book / Transactions stream. Query filters by `invoice.salesmanId`.
  4. Outflow payment is excluded. Salesman drawer reflects ₹1,200 deficit against reported stream.
- **Proposed Fix**:
  - **Backend**: Add `createdById: userId` to `Payment` schema and populate it during payment creation. Update salesman filter in `payments.service.ts:845`:
    `{ OR: [{ invoice: { salesmanId: user.id } }, { refundInvoice: { createdById: user.id } }, { createdById: user.id }] }`.
    Add `refundInvoice: { select: { id: true, refundNo: true, total: true } }` to `includeRelations`.
  - **Web Dashboard**: Update `recent-transactions-stream.tsx` to display `refundInvoice.refundNo` when `invoice` is null.
  - **Mobile App**: In `PaymentCard.tsx`, render "Refund Note #" badge when `payment.refundInvoice` is present.

---

#### ISS-03: Critical Inversion of Refund Payouts in Frontend Web Dashboard
- **Locations**:
  - Web: `web-dashboard/componentsWeb/invoices/invoice-details-drawer.tsx:72–74`
  - Web: `web-dashboard/lib/whatsapp.ts:204–206`
  - Backend: `backend/src/invoices/invoices.service.ts:650–680`
- **Root Cause & Trigger Conditions**:
  `invoice-details-drawer.tsx:73` calculates paid amount using:
  `.filter((payment) => payment.status === 'CONFIRMED' && payment.mode !== 'OUTFLOW')`.
  In Prisma schema (`schema.prisma:282, 289`), `mode` is `PaymentMode` (`CASH`, `UPI`, `CREDIT`), while `type` is `PaymentType` (`INFLOW`, `OUTFLOW`). The condition `payment.mode !== 'OUTFLOW'` is always true. Cash/UPI refund payouts (`type: OUTFLOW, mode: CASH`) are summed as positive inflows.
- **Data Flow Breakdown**:
  1. Invoice of ₹10,000 is paid upfront via UPI (`type: INFLOW, amount: 10,000`).
  2. Customer returns ₹3,000 goods for cash refund (`type: OUTFLOW, mode: CASH, amount: 3,000`).
  3. Web drawer computes `paidAmount = 10,000 + 3,000 = ₹13,000`.
  4. Drawer and WhatsApp invoice share state that customer paid ₹13,000 on a ₹10,000 invoice.
- **Proposed Fix**:
  - **Backend**: Return computed financial fields (`netAdjustedTotal`, `confirmedInflows`, `confirmedOutflows`, `balanceDue`) directly from invoice endpoints.
  - **Web Dashboard**: In `invoice-details-drawer.tsx:73` and `whatsapp.ts:205`, replace `payment.mode !== 'OUTFLOW'` with `payment.type === 'INFLOW'`. Subtract confirmed `OUTFLOW` payments from total collected.
  - **Mobile App**: Audit mobile invoice detail view to ensure `payment.type === 'INFLOW'` is enforced.

---

#### ISS-04: Destructive Invoice Status Transitions on Return
- **Locations**:
  - Backend: `backend/src/invoices/invoices.service.ts:1304–1315, 2682–2686`
  - Backend: `backend/prisma/schema.prisma:45–51`
  - Web: `web-dashboard/appWeb/dashboard/invoices/page.tsx:85–110`
  - Mobile: `mobile-app/src/utils/filterInvoiceList.ts:20–45`
- **Root Cause & Trigger Conditions**:
  When a return is processed, lines 1304–1308 execute:
  `const newStatus = totalRefundedSoFar >= invoiceTotal - 0.01 ? InvoiceStatus.CANCELLED : InvoiceStatus.PARTIAL;`.
  If an invoice was 100% paid and customer returns 1 item for cash refund, the status degrades to `PARTIAL`. If 100% returned, it becomes `CANCELLED`. In Prisma, `enum InvoiceStatus` lacks a `RETURNED` status.
- **Data Flow Breakdown**:
  1. Invoice of ₹20,000 is fully paid (`status: PAID`).
  2. Customer returns ₹2,000 goods and receives cash.
  3. Status changes to `PARTIAL`. Invoice now appears on unpaid receivables and dues lists.
- **Proposed Fix**:
  - **Backend**: Add `RETURNED` to `InvoiceStatus` in `schema.prisma`. In `invoices.service.ts:1304`, determine status based on net settlement:
    `const netDue = Math.max(0, netAdjustedTotal - confirmedInflows);`.
    If `totalRefundedSoFar >= invoiceTotal - 0.01`, set `RETURNED`. Else if `netDue <= 0.01`, maintain `PAID`. Set `PARTIAL` only if unpaid balance remains.
  - **Web Dashboard**: Add badge styling and tab filtering for `RETURNED` in `invoices/page.tsx`.
  - **Mobile App**: Update `filterInvoiceList.ts` to support `RETURNED` status without treating it as overdue debt.

---

#### ISS-05: Batch Number Nullification in Returns Enabling Infinite Over-Returns
- **Locations**:
  - Backend: `backend/src/invoices/invoices.service.ts:1049, 1136`
  - Web: `web-dashboard/componentsWeb/invoices/return-invoice-modal.tsx:90–120`
  - Mobile: `mobile-app/src/components/invoices/ReturnInvoiceModal.tsx:75–105`
- **Root Cause & Trigger Conditions**:
  In `invoices.service.ts:1049`, return validation tracks returned quantities by composite key:
  `const key = `${retItem.productId}_${retItem.batchNo || ''}`;`.
  However, persistence at line 1136 hardcodes:
  `batchNo: null`.
  On subsequent return attempts for the same invoice, prior returns evaluate to `ProductID_`, failing to match `ProductID_BATCH-1`. The returnable quantity never decrements against the batched item.
- **Data Flow Breakdown**:
  1. Invoice sells 10 boxes of Tile A (`batchNo: "LOT-99"`).
  2. Customer returns 10 boxes with `batchNo: "LOT-99"`.
  3. Backend saves `RefundInvoiceItem` with `batchNo: null`.
  4. Customer submits a second return for 10 boxes with `batchNo: "LOT-99"`.
  5. Validation checks prior returns for `TileA_LOT-99`. Finds 0. Second return is approved.
- **Proposed Fix**:
  - **Backend**: In `invoices.service.ts:1136`, preserve `batchNo: item.batchNo || null`. In validation (line 1049), track returns by `invoiceItemId` directly rather than composite strings.
  - **Web Dashboard**: Pass `batchNo` and `invoiceItemId` from selected invoice item in `return-invoice-modal.tsx`.
  - **Mobile App**: Bind `batchNo` and `invoiceItemId` in `ReturnInvoiceModal.tsx`.

---

#### ISS-06: Warehouse Bypass in Inventory Restocking & Reversals
- **Locations**:
  - Backend: `backend/src/invoices/invoices.service.ts:1095–1100, 1447–1452, 2557–2560, 2725–2728`
  - Web: `web-dashboard/componentsWeb/invoices/return-invoice-modal.tsx:140–180`
  - Mobile: `mobile-app/src/components/invoices/ReturnInvoiceModal.tsx:120–150`
- **Root Cause & Trigger Conditions**:
  When restocking inventory on returns or reversing restocks on return deletion, the service queries:
  `let existingStock = await tx.stockLedger.findFirst({ where: { productId: item.productId }, orderBy: { updatedAt: 'desc' } });`.
  Warehouse ID is completely ignored. Inventory is credited to whatever warehouse record was updated most recently.
- **Data Flow Breakdown**:
  1. Main Godown (Warehouse A) sold the tiles.
  2. Customer physically returns tiles to Showroom (Warehouse B).
  3. Backend increments Warehouse C because it had a stock adjustment 2 minutes ago.
  4. Physical warehouse stock diverges from digital inventory records.
- **Proposed Fix**:
  - **Backend**: Accept `warehouseId` per returned item in `processReturn` and `processStandaloneReturn`. Target `where: { productId, warehouseId: item.warehouseId || originalItem.warehouseId }` in `StockLedger`.
  - **Web Dashboard**: Add warehouse selection dropdown for returned items in `return-invoice-modal.tsx`.
  - **Mobile App**: Add warehouse selector in `ReturnInvoiceModal.tsx`.

---

#### ISS-07: Unvalidated Return Unit Prices & Unaccounted Bill Discounts
- **Locations**:
  - Backend: `backend/src/invoices/invoices.service.ts:1042–1067, 1090–1145`
  - Web: `web-dashboard/componentsWeb/invoices/return-invoice-modal.tsx:190–215`
  - Mobile: `mobile-app/src/components/invoices/ReturnInvoiceModal.tsx:160–185`
- **Root Cause & Trigger Conditions**:
  In `processReturn`, lines 1042–1067 validate quantity but never verify whether `retItem.unitPrice <= purchasedItem.unitPrice`. Furthermore, refund calculations use undiscounted line item prices, ignoring invoice-level `discountAmount`.
- **Data Flow Breakdown**:
  1. Customer buys ₹10,000 of goods with a ₹2,000 bill discount (net ₹8,000 paid).
  2. Return payload specifies undiscounted unit prices or an inflated unit price.
  3. System refunds ₹10,000 for goods the customer bought for ₹8,000, creating a ₹2,000 cash leak.
- **Proposed Fix**:
  - **Backend**: In `processReturn`, enforce `retItem.unitPrice <= purchasedItem.unitPrice`. Prorate invoice discounts: `effectivePrice = unitPrice * (1 - discountAmount / subtotal)`. Enforce cumulative refund check: `totalRefundedSoFar + currentRefund <= invoice.total`.
  - **Web Dashboard**: Lock `unitPrice` input to purchased effective unit price by default.
  - **Mobile App**: Display effective discounted unit price in return modal and prevent manual inflation.

---

#### ISS-08: Permanent Eradication of Customer Debt on Return Deletion
- **Locations**:
  - Backend: `backend/src/invoices/invoices.service.ts:2741–2748`
  - Web: `web-dashboard/componentsWeb/invoices/invoice-details-drawer.tsx:320–345`
- **Root Cause & Trigger Conditions**:
  When a return created with `refundMode: CREDIT` is deleted via `deleteReturn()`, the service executes `tx.payment.deleteMany` and `tx.creditLedger.deleteMany` for `refundInvoiceId: refundId`. It fails to restore the receivable debt on the invoice's `CreditLedger` that was reduced during `processReturn()`.
- **Data Flow Breakdown**:
  1. Customer owes ₹10,000 on an invoice (`CreditLedger` receivable = ₹10,000).
  2. Customer returns ₹4,000 goods under Store Credit. `processReturn` reduces invoice `CreditLedger.amountDue` to ₹6,000.
  3. Admin deletes the return.
  4. The return is deleted, but the invoice `CreditLedger` remains at ₹6,000.
  5. The customer's ₹4,000 debt is permanently erased from the system.
- **Proposed Fix**:
  - **Backend**: In `deleteReturn()`, if the return had reduced receivable debt on the original invoice, increment the original invoice's `CreditLedger.amountDue` by the return amount and revert status to `UNPAID`/`PARTIAL`.
  - **Web Dashboard**: Display confirmation dialog detailing receivable restoration before allowing return deletion.

---

#### ISS-09: Live Credit Ledger Re-Querying on Historical Invoice PDF Generation
- **Locations**:
  - Backend: `backend/src/invoices/invoices.service.ts:1639–1657`
  - Backend: `backend/src/invoices/pdf/invoice-pdf.generator.ts:120–145`
- **Root Cause & Trigger Conditions**:
  When reprinting an invoice PDF, `invoices.service.ts:1639–1644` re-queries the current unsettled ledgers:
  `const prevCreditLedgers = await this.prisma.creditLedger.findMany({ where: { partyId, status: { not: SETTLED }, createdAt: { lt: invoice.createdAt } } });`.
  If past ledgers have been settled since the invoice was generated, the reprinted PDF displays ₹0 previous balance instead of what was printed originally.
- **Data Flow Breakdown**:
  1. Invoice #100 was issued with "Previous Balance: ₹15,000" and Total: ₹25,000.
  2. Customer settles the ₹15,000 old debt.
  3. Months later, customer requests a reprint of Invoice #100 for tax audit.
  4. Backend re-queries unsettled ledgers; finds 0. PDF reprints with "Previous Balance: ₹0.00".
- **Proposed Fix**:
  - **Backend**: Use `Number(invoice.previousBalance || 0)` saved on the `Invoice` model at creation time. Remove live dynamic `CreditLedger` query during PDF generation.

---

#### ISS-10: Hardcoded Standalone Return Tax Breakup & GST Jurisdictions
- **Locations**:
  - Backend: `backend/src/invoices/invoices.service.ts:1524–1530`
  - Backend: `backend/src/invoices/pdf/refund-pdf.generator.ts:394`
  - Web: `web-dashboard/componentsWeb/invoices/standalone-return-modal.tsx:80–115`
  - Mobile: `mobile-app/src/components/invoices/ReturnInvoiceModal.tsx:190–210`
- **Root Cause & Trigger Conditions**:
  In `invoices.service.ts:1524–1530`, tax breakup is hardcoded:
  `taxBreakup: { rate: 18, cgst: totalTax / 2, sgst: totalTax / 2, igst: 0, isInterState: false }`.
  Interstate customers and non-18% GST goods produce incorrect tax splits. In `refund-pdf.generator.ts:394`, `const taxRate = taxBreakup.rate || 18` forces 18% when rate is 0.
- **Data Flow Breakdown**:
  1. Standalone return processed for an interstate party (IGST) for marble tiles (12% GST).
  2. Backend records 18% CGST/SGST.
  3. GSTR-1 credit note export contains invalid state tax allocation and incorrect GST rate.
- **Proposed Fix**:
  - **Backend**: Compute `isInterState` by comparing party state code with company profile state code. Accept tax rate per item or use party default. Allocate to IGST when interstate, else split CGST/SGST.
  - **Web Dashboard & Mobile**: Allow tax rate selection and verify GSTIN state prefix in standalone return modals.

---

#### ISS-11: Static UPI QR Generation Requesting Full Bill Total Regardless of Prior Payments/Returns
- **Locations**:
  - Backend: `backend/src/invoices/invoices.service.ts:836–842`
  - Web: `web-dashboard/componentsWeb/invoices/invoice-details-drawer.tsx:210–235`
  - Mobile: `mobile-app/src/components/invoices/InvoiceCard.tsx:145–170`
- **Root Cause & Trigger Conditions**:
  In `invoices.service.ts:839`, UPI QR generation sets:
  `amount: invoice.total.toString()`.
  If an invoice has received partial payments or has issued credit notes, the generated dynamic UPI QR code still requests the initial total.
- **Data Flow Breakdown**:
  1. Invoice total is ₹50,000. Customer paid ₹30,000 upfront. Remaining balance is ₹20,000.
  2. Customer requests UPI QR code to pay remaining balance.
  3. Scanned QR code prompts customer for ₹50,000. Customer refuses or overpays.
- **Proposed Fix**:
  - **Backend**: In `invoices.service.ts:839`, set `amount: balanceDue.toFixed(2)` where `balanceDue = Math.max(0, netAdjustedTotal - confirmedInflows)`.
  - **Web & Mobile**: Render current `balanceDue` beside the QR code and update QR image dynamically.

---

### Domain 2: Purchases, Vendor Bills & Debit Notes (Issues ISS-12 to ISS-25)

#### ISS-12: Debit Notes Omit Stock Reduction (Zero Inventory Outwarding on Purchase Returns)
- **Locations**:
  - Backend: `backend/src/purchases/purchases.service.ts:685–811` (`createDebitNote`)
  - Backend: `backend/prisma/schema.prisma:604–618` (`model DebitNote`)
  - Backend DTO: `backend/src/purchases/dto/create-purchase.dto.ts:89–97` (`CreateDebitNoteDto`)
  - Web: `web-dashboard/appWeb/dashboard/purchases/page.tsx:183–208`
  - Mobile: `mobile-app/src/components/purchases/` (missing)
- **Root Cause & Trigger Conditions**:
  `CreateDebitNoteDto` only accepts `amount` and `reason`. In `createDebitNote`, the transaction writes to `tx.debitNote` and `tx.creditLedger`, but contains zero operations on `tx.stockLedger`. `DebitNote` model has no line items or warehouse fields.
- **Data Flow Breakdown**:
  1. 100 boxes of defective tiles purchased and inwarded into `StockLedger`.
  2. 30 boxes returned to vendor; Debit Note generated for ₹15,000.
  3. Financial ledger reflects ₹15,000 credit, but `StockLedger` remains at 100 boxes.
  4. Salesmen commit sales against 30 boxes of ghost inventory.
- **Proposed Fix**:
  - **Backend**: Add `DebitNoteItem` model to `schema.prisma` with `productId`, `warehouseId`, `qty`, `unitPrice`. Accept optional items array in `CreateDebitNoteDto`. In `createDebitNote`, decrement `StockLedger` with row-level locks and validate available inventory.
  - **Web & Mobile**: Add item selection and return quantity inputs to Debit Note creation modals.

---

#### ISS-13: Missing Debit Note Validation (Amount Uncapped & No Stock Check)
- **Locations**:
  - Backend: `backend/src/purchases/purchases.service.ts:685–715`
  - Web: `web-dashboard/appWeb/dashboard/purchases/page.tsx:183–208`
- **Root Cause & Trigger Conditions**:
  `createDebitNote` verifies that purchase is not `CANCELLED`, but never checks whether `dto.amount` exceeds `purchase.total` or whether cumulative debit notes exceed the purchase value.
- **Data Flow Breakdown**:
  1. Purchase total is ₹25,000.
  2. User inputs ₹1,00,000 in Debit Note modal.
  3. Backend saves Debit Note and credits vendor ledger with ₹75,000 in advance supplier receivables.
  4. Phantom asset created out of thin air.
- **Proposed Fix**:
  - **Backend**: In `createDebitNote`, aggregate existing debit notes:
    `const priorTotal = (purchase.debitNotes || []).reduce((s, dn) => s + Number(dn.amount), 0);`
    `const maxAllowed = Number(purchase.total) - priorTotal;`
    `if (dto.amount > maxAllowed + 0.005) throw new BadRequestException(...);`.
  - **Web Dashboard**: Set `max={maxAllowed}` on input and enforce client-side boundary validation.

---

#### ISS-14: Stock Inwarding Hardcodes Warehouse to `null` and Bypasses Multi-Warehouse Tracking
- **Locations**:
  - Backend: `backend/src/purchases/purchases.service.ts:317–388`
  - Backend DTO: `backend/src/purchases/dto/create-purchase.dto.ts:21–27`
  - Web: `web-dashboard/componentsWeb/purchases/create-purchase-modal.tsx:37–44, 214–220`
  - Mobile: `mobile-app/src/components/purchases/CreatePurchaseModal.tsx:180–210`
- **Root Cause & Trigger Conditions**:
  In `purchases.service.ts:358–364`, new stock records are created with `warehouseId: null, batchNo: null`. Existing stock queries match `where: { productId: item.productId }` without warehouse scoping. In `create-purchase-modal.tsx`, `warehouses` prop is dropped during destructuring.
- **Data Flow Breakdown**:
  1. Purchase arrives at Warehouse B. User passes `warehouseId = Warehouse B`.
  2. Backend matches existing `StockLedger` row for Warehouse A because it was updated recently.
  3. Warehouse A stock increments; Warehouse B stock remains zero.
- **Proposed Fix**:
  - **Backend**: In `purchases.service.ts:317`, query `where: { productId: item.productId, warehouseId: item.warehouseId || null, batchNo: item.batchNo || null }`. Persist `item.warehouseId` in both `StockLedger` and `PurchaseItem`.
  - **Web & Mobile**: Restore `warehouses` prop and render warehouse dropdown per line item.

---

#### ISS-15: Upfront Paid Purchases Never Transition to `PAID` (Stuck in `CREATED`)
- **Locations**:
  - Backend: `backend/src/purchases/purchases.service.ts:463–479`
  - Backend: `backend/src/payments/payments.service.ts:89–100` (`onModuleInit`)
  - Web: `web-dashboard/appWeb/dashboard/purchases/page.tsx:120–145`
  - Mobile: `mobile-app/src/components/purchases/PurchasesView.tsx:65–90`
- **Root Cause & Trigger Conditions**:
  When creating a purchase, `status` is not specified, defaulting to `CREATED`. If 100% paid upfront (`balancePayable === 0`), no `CreditLedger` entry is created. The auto-heal query in `payments.service.ts:89` queries `WHERE "purchaseId" IN (SELECT "purchaseId" FROM "CreditLedger")`, permanently skipping upfront purchases.
- **Data Flow Breakdown**:
  1. ₹50,000 purchase paid in full with cash on arrival.
  2. Purchase saved with `status: CREATED`. No `CreditLedger` row created.
  3. Purchase displays as pending/unsettled forever on purchase dashboards.
- **Proposed Fix**:
  - **Backend**: In `purchases.service.ts:463`, calculate initial status:
    `const initialStatus = balancePayable <= 0.005 ? InvoiceStatus.PAID : amountPaidNow > 0 ? InvoiceStatus.PARTIAL : InvoiceStatus.CREATED;`. Pass `status: initialStatus` to `tx.purchase.create`.
  - Update `onModuleInit` query to also mark purchases as `PAID` if confirmed payment sum equals total.

---

#### ISS-16: Purchase Editing Completely Blocked for Upfront Purchases Due to Note Substring Mismatch
- **Locations**:
  - Backend: `backend/src/purchases/purchases.service.ts:76–94, 502–505`
  - Web: `web-dashboard/componentsWeb/purchases/edit-purchase-modal.tsx:50–85`
- **Root Cause & Trigger Conditions**:
  In `update()`, purchases are blocked from editing if payment notes do not contain `'upfront'` or `'purchase creation'`. However, `create()` writes notes as:
  `Supplier payment of ₹... (...) for PUR-...`.
  `isUpfront` evaluates to false, causing `update()` to always throw HTTP 400.
- **Data Flow Breakdown**:
  1. Purchase created with upfront payment. Note generated as `"Supplier payment of ₹5000.00 (CASH) for PUR-001"`.
  2. User edits purchase to fix vendor bill number typo.
  3. Backend checks for substring `"upfront"`. Not found. Edit rejected.
- **Proposed Fix**:
  - **Backend**: In `purchases.service.ts:502`, write standardized note:
    `Upfront supplier payment of ₹${split.amount.toFixed(2)} (${split.mode}) for purchase creation ${purchaseNo}`.
    In line 76, check timestamp proximity (`Math.abs(payment.createdAt - purchase.createdAt) < 10000ms`) as a resilient fallback.

---

#### ISS-17: Subsequent Vendor Payments Cannot Link to Purchases (`purchaseId: null`)
- **Locations**:
  - Backend DTO: `backend/src/payments/dto/create-payment.dto.ts:16–52`
  - Backend Service: `backend/src/payments/payments.service.ts:559–578`
  - Web: `web-dashboard/componentsWeb/payments/settlement-modal.tsx:242–260`
  - Mobile: `mobile-app/src/components/payments/CollectPaymentModal.tsx:80–110`
- **Root Cause & Trigger Conditions**:
  `CreatePaymentDto` lacks `purchaseId`. When paying vendor purchase dues via the Payments screen, `purchaseId` is never passed or persisted. In `purchases.service.ts:658` (`findOne`), `payments: true` returns empty.
- **Data Flow Breakdown**:
  1. Purchase made on 30-day credit for ₹80,000.
  2. 15 days later, accountant pays ₹80,000 to vendor.
  3. Payment saved with `partyId: vendorId, purchaseId: null`.
  4. Purchase details drawer shows ₹0 paid, contradicting the vendor statement.
- **Proposed Fix**:
  - **Backend**: Add `@IsString() @IsOptional() purchaseId?: string;` to `CreatePaymentDto` and persist `purchaseId: data.purchaseId || null`. Synchronize purchase status to `PAID`/`PARTIAL`.
  - **Web & Mobile**: Allow selecting outstanding purchase bills in vendor settlement modals and pass `purchaseId`.

---

#### ISS-18: Payment Deletion Leaves Settled Vendor Ledgers at Zero Due (Phantom Zero Debt)
- **Locations**:
  - Backend: `backend/src/payments/payments.service.ts:1450–1545` (`deletePayment`)
  - Web: `web-dashboard/componentsWeb/payments/recent-transactions-stream.tsx:110–135`
- **Root Cause & Trigger Conditions**:
  In `deletePayment()`, subsequent vendor payments have `purchaseId: null` (Issue 17). Thus, purchase recalculation blocks do not execute. The settled `CreditLedger` entry that was settled by the deleted payment is never restored; `amountDue` remains 0 and status remains `SETTLED`.
- **Data Flow Breakdown**:
  1. Company owes vendor ₹50,000.
  2. Erroneous payment entry settles vendor `CreditLedger` to 0.
  3. Accountant deletes the payment entry.
  4. Payment row is removed, but vendor `CreditLedger` remains `SETTLED` at ₹0 due.
  5. The company's legal debt disappears from the ERP.
- **Proposed Fix**:
  - **Backend**: In `deletePayment()`, if `payment.type === PaymentType.OUTFLOW` and `payment.partyId` is set, restore the deleted amount to the party's linked or oldest `PAYABLE` credit ledgers and revert status to `PARTIAL`/`UNPAID`.

---

#### ISS-19: Purchase Deletion Destroys Reconciled Payment Records Without Safety Checks
- **Locations**:
  - Backend: `backend/src/purchases/purchases.service.ts:813–873` (`deletePurchase`)
  - Web: `web-dashboard/componentsWeb/purchases/purchase-details-drawer.tsx:180–210`
- **Root Cause & Trigger Conditions**:
  `deletePurchase` checks `purchase.debitNotes`, but never checks `purchase.payments`. Deleting a purchase executes `tx.payment.deleteMany({ where: { purchaseId: id } })`, wiping confirmed bank and cash transaction records.
- **Data Flow Breakdown**:
  1. Purchase created and paid ₹2,00,000 via RTGS.
  2. User deletes purchase.
  3. Backend deletes purchase and deletes payment rows.
  4. Bank register and cash flow accounts desynchronize from actual bank statements.
- **Proposed Fix**:
  - **Backend**: In `deletePurchase`, block deletion if confirmed payments exist:
    `if (purchase.payments.some(p => p.status === PaymentStatus.CONFIRMED)) throw new BadRequestException('Cannot delete purchase with confirmed payments. Void payments first.');`.

---

#### ISS-20: Backend `findAll` Omits `debitNotes`, Breaking Web UI Calculations & Table Badges
- **Locations**:
  - Backend: `backend/src/purchases/purchases.service.ts:558–564`
  - Web: `web-dashboard/appWeb/dashboard/purchases/page.tsx:149–154, 380–382, 417–421`
- **Root Cause & Trigger Conditions**:
  In `purchases.service.ts:558–564`, `includeRelations` omits `debitNotes`. Every purchase returned by `/purchases` has `p.debitNotes = undefined`. In web `page.tsx`, `totalDebitNotes` and debit note badges evaluate to 0.
- **Data Flow Breakdown**:
  1. ₹50,000 of debit notes issued against purchases.
  2. Web Purchases page opens.
  3. "Total Debit Notes" summary card displays `₹0.00`. Table badges show no returns.
- **Proposed Fix**:
  - **Backend**: Add `debitNotes: true` to `includeRelations` in `purchases.service.ts:564`.

---

#### ISS-21: Mobile App Inverts Supplier Credits into Vendor Payable Dues (Phantom Debt)
- **Locations**:
  - Mobile: `mobile-app/src/components/purchases/PurchasesView.tsx:47–56` (`getPurchaseDueAmount`)
- **Root Cause & Trigger Conditions**:
  When a debit note generates a `CreditLedger` with `type: CreditType.RECEIVABLE` (vendor owes us money), mobile `getPurchaseDueAmount` sums all ledgers with `status !== 'SETTLED'` without checking `c.type`.
- **Data Flow Breakdown**:
  1. Purchase was ₹20,000, paid in full upfront.
  2. Debit Note issued for ₹5,000 defective tiles. `CreditLedger` created: `type: RECEIVABLE, amountDue: 5000`.
  3. Mobile app evaluates `getPurchaseDueAmount` and adds ₹5,000 to purchase due.
  4. Mobile app displays: `Due: ₹5,000` payable to vendor.
- **Proposed Fix**:
  - **Mobile App**: In `PurchasesView.tsx:47–56`, filter by credit type:
    `c.type === 'PAYABLE' && c.status !== 'SETTLED'`. If `c.type === 'RECEIVABLE'`, display under a separate "Supplier Credit Refund Due" badge.

---

#### ISS-22: Mobile App Truncates Fractional Quantities via `parseInt` in Purchase Subtotal
- **Locations**:
  - Mobile: `mobile-app/src/components/purchases/CreatePurchaseModal.tsx:287–294, 401`
- **Root Cause & Trigger Conditions**:
  `CreatePurchaseModal.tsx:289` calculates subtotal using `parseInt(it.qty, 10)`, while payload submission uses `parseFloat(it.qty)`. Fractional tile quantities (e.g. 15.5 boxes, 42.75 sq.m) have their decimals truncated in UI calculations.
- **Data Flow Breakdown**:
  1. User enters 10.5 boxes at ₹1,000/box.
  2. Mobile UI displays Total = ₹10,000 (`parseInt(10.5) * 1000`).
  3. User enters ₹10,000 paid.
  4. Backend receives `qty: 10.5`, calculates total = ₹10,500, and creates an unexpected ₹500 outstanding debt.
- **Proposed Fix**:
  - **Mobile App**: Replace `parseInt(it.qty, 10)` with `parseFloat(it.qty) || 0` in `CreatePurchaseModal.tsx:289`.

---

#### ISS-23: Mobile App Completely Lacks Debit Note Functionality
- **Locations**:
  - Mobile: `mobile-app/src/app/(tabs)/more.tsx:570–575`
  - Mobile: `mobile-app/src/components/purchases/`
- **Root Cause & Trigger Conditions**:
  The menu description claims debit note support, but zero debit note components or modals exist in `mobile-app/src/`. Warehouse supervisors on mobile cannot document purchase returns at receiving docks.
- **Proposed Fix**:
  - **Mobile App**: Implement `CreateDebitNoteModal.tsx` in `mobile-app/src/components/purchases/` and add a "Debit Note" action button in `PurchasesView.tsx`.

---

#### ISS-24: Party Auto-Healing Reconcile Deducts Vendor Outflows from Customer Inflows
- **Locations**:
  - Backend: `backend/src/payments/payments.service.ts:181–187` (`reconcilePartyFinancials`)
- **Root Cause & Trigger Conditions**:
  Because subsequent payments to vendors have `purchaseId = null` (ISS-17), they match `!p.purchaseId`. If a party acts as both customer and supplier, `reconcilePartyFinancials` subtracts vendor procurement disbursements from customer sales receipts.
- **Data Flow Breakdown**:
  1. Contractor buys ₹1,00,000 of tiles and pays ₹1,00,000.
  2. Contractor supplies ₹80,000 of sand; business pays contractor ₹80,000 (`type: OUTFLOW, purchaseId: null`).
  3. Auto-healing computes `remainingPayment = 100,000 - 80,000 = ₹20,000`.
  4. System marks tile invoice as only ₹20,000 paid, billing contractor for ₹80,000 unpaid dues.
- **Proposed Fix**:
  - **Backend**: In `reconcilePartyFinancials`, never subtract `OUTFLOW` payments from customer inflow pools unless linked to customer refund credit notes (`refundInvoiceId != null`). Scope vendor payouts exclusively to `CreditType.PAYABLE` ledgers.

---

#### ISS-25: Analytics GSTR-3B Tax Calculation Fails to Reverse ITC for Debit Notes
- **Locations**:
  - Backend: `backend/src/analytics/analytics.service.ts:1320–1365` (`getGstr3bReport`)
  - Web: `web-dashboard/appWeb/dashboard/day-book/page.tsx:220–250`
- **Root Cause & Trigger Conditions**:
  Under Indian GST Law (Section 34 CGST Act), debit notes issued to vendors represent an Input Tax Credit (ITC) reversal. `getGstr3bReport` aggregates `purchaseTax` without deducting tax on debit notes.
- **Data Flow Breakdown**:
  1. Business purchases ₹10,00,000 + 18% GST (₹1,80,000 ITC).
  2. Business issues ₹2,00,000 in Debit Notes (₹36,000 ITC to reverse).
  3. Actual eligible ITC is ₹1,44,000.
  4. System reports ₹1,80,000 eligible ITC, underreporting net tax payable by ₹36,000.
- **Proposed Fix**:
  - **Backend**: In `getGstr3bReport`, query debit notes in the date range, calculate tax based on parent purchase tax rate, and deduct from eligible ITC:
    `const eligibleItc = Math.max(0, purchaseTax - debitNoteTax);`.

---

### Domain 3: Payments, Parties, Credit Ledgers & Settlements (Issues ISS-26 to ISS-36)

#### ISS-26: Double Store Credit Created on Returns in `reconcilePartyFinancials`
- **Locations**:
  - Backend: `backend/src/payments/payments.service.ts:292–341`
  - Backend: `backend/src/invoices/invoices.service.ts:1248–1272`
- **Root Cause & Trigger Conditions**:
  When a return is processed with Store Credit, `invoices.service.ts` creates a `CreditLedger` (`type: PAYABLE, refundInvoiceId: refund.id`). Later, `reconcilePartyFinancials` calculates `remainingPayment = totalInflows - totalOutflows - (invTotal - refunded)`. Because line 293 filters `refundInvoiceId: null`, it ignores the existing store credit ledger and creates an *additional* `CreditLedger` (`type: PAYABLE, notes: 'Advance customer balance...'`).
- **Data Flow Breakdown**:
  1. Customer pays ₹10,000 on Invoice #1.
  2. Customer returns ₹2,000 goods for Store Credit. `invoices.service.ts` creates `CreditLedger(PAYABLE, ₹2,000)`.
  3. `reconcilePartyFinancials` executes. `remainingPayment` evaluates to ₹2,000 excess.
  4. `reconcilePartyFinancials` creates second `CreditLedger(PAYABLE, ₹2,000)`.
  5. Customer now has ₹4,000 in credit.
- **Proposed Fix**:
  - **Backend**: In `payments.service.ts:292–341`, include all un-settled `PAYABLE` ledgers (including those with `refundInvoiceId`) in the credit pool, or deduct existing store credits from `remainingPayment` before creating advance balance ledgers.
  - Deploy one-time deduplication script on server startup (`onModuleInit`).

---

#### ISS-27: Earmarked Invoice Payments Hijacked by Global FIFO Reallocation
- **Locations**:
  - Backend: `backend/src/payments/payments.service.ts:181–248`
  - Backend: `backend/src/delivery/delivery.service.ts:806–838`
- **Root Cause & Trigger Conditions**:
  `reconcilePartyFinancials` pools all payments (`totalInflows - totalOutflows`), strips `payment.invoiceId`, sorts invoices by `createdAt: 'asc'`, and allocates funds strictly FIFO. Payments intended for specific new invoices are reallocated to older disputed bills.
- **Data Flow Breakdown**:
  1. Customer has Invoice 1 (₹5,000, unpaid, disputed).
  2. Customer orders Invoice 2 (₹10,000, cash on delivery) and pays ₹10,000 with `invoiceId: 'inv-2'`.
  3. Auto-healing runs: ₹5,000 settles Invoice 1; Invoice 2 is flipped to `PARTIAL` with ₹5,000 due.
  4. Delivery driver for Invoice 2 is instructed to collect ₹5,000 from customer.
- **Proposed Fix**:
  - **Backend**: In `reconcilePartyFinancials`, partition payments into:
    1. **Earmarked Payments**: `invoiceId != null` apply strictly to their designated invoice.
    2. **Unallocated Payments**: `invoiceId == null` apply FIFO across remaining balances.
    Never allow an earmarked payment for Invoice B to settle Invoice A.

---

#### ISS-28: Incomplete Confirmation Flow in `confirmPayment` (Missing Invoice, Purchase, Delivery Sync)
- **Locations**:
  - Backend: `backend/src/payments/payments.service.ts:937–1083` (`confirmPayment`)
  - Web: `web-dashboard/componentsWeb/payments/pending-payments-drawer.tsx:75–110`
- **Root Cause & Trigger Conditions**:
  `confirmPayment` updates `creditEntry.amountDue`, but unlike `create()`, it omits updating `invoice.status` to `PAID`/`PARTIAL`, omits updating linked `delivery.amountToCollect`, and omits calling `reconcilePartyFinancials`.
- **Data Flow Breakdown**:
  1. Driver collects ₹15,000 payment; recorded as `PENDING`.
  2. Cashier confirms payment in dashboard.
  3. `creditLedger` updates, but `invoice.status` remains `PARTIAL` and `delivery.amountToCollect` remains ₹15,000.
  4. Dispatch board continues to mark order as awaiting payment.
- **Proposed Fix**:
  - **Backend**: In `confirmPayment`:
    - Synchronize linked `Invoice` status and active `Delivery.amountToCollect`.
    - Synchronize linked `Purchase` status when `purchaseId` is present.
    - Support vendor overpayment creation when `payment.type === PaymentType.OUTFLOW`.
    - Call `await this.reconcilePartyFinancials(targetPartyId, tx)`.

---

#### ISS-29: Vendor Purchase Payments Missing Links & Status Rollback on Deletion
- **Locations**:
  - Backend: `backend/src/payments/payments.service.ts:1522–1544`
  - Web: `web-dashboard/componentsWeb/payments/settlement-modal.tsx:242–260`
- **Root Cause & Trigger Conditions**:
  `settlement-modal.tsx` does not supply `purchaseId` when paying vendors. When deleting a purchase payment in `deletePayment`, `creditLedger` updates but `purchase.status` is left untouched as `PAID`.
- **Data Flow Breakdown**:
  1. Purchase marked `PAID` via payment.
  2. Payment is deleted.
  3. `CreditLedger` is updated, but `purchase.status` remains `PAID`.
- **Proposed Fix**:
  - **Backend**: In `deletePayment`, recalculate confirmed payments for `payment.purchaseId` and update `purchase.status` to `PARTIAL` or `CREATED`.
  - **Web Dashboard**: Allow selecting specific purchases in `settlement-modal.tsx`.

---

#### ISS-30: Opening Balance Regex Parsing Failure on Dates and Prefixes
- **Locations**:
  - Backend: `backend/src/payments/payments.service.ts:162, 175`
  - Backend: `backend/src/parties/parties.service.ts:28–38`
- **Root Cause & Trigger Conditions**:
  `payments.service.ts` parses opening balances using `cl.notes?.match(/([0-9.]+)/)?.[1]`. In strings such as `"Opening balance 2024 due from customer ₹5000"`, it matches `"2024"` instead of `"5000"`.
- **Data Flow Breakdown**:
  1. Customer opening balance recorded as `"Opening balance 2024 due from customer ₹5000"`.
  2. Auto-healing extracts opening balance as ₹2,024 instead of ₹5,000.
  3. Customer balance is understated by ₹2,976.
- **Proposed Fix**:
  - **Backend**: Adopt the robust regex from `parties.service.ts`:
    `/Opening balance (?:due from customer|payable to vendor):? ?(?:₹|Rs\.?)? ?([0-9.]+)/i` or read from a dedicated decimal column.

---

#### ISS-31: Flawed Net Liability Rendering in Mobile & Web Party Directory (Zero-Balance Accounts Shown as Payables)
- **Locations**:
  - Mobile: `mobile-app/src/components/parties/PartyStatementDrawer.tsx:165–175`
  - Mobile: `mobile-app/src/components/parties/partyRows.ts:88`
  - Web: `web-dashboard/appWeb/dashboard/parties/page.tsx:96–98`
- **Root Cause & Trigger Conditions**:
  In mobile `PartyStatementDrawer.tsx`, line 171 evaluates `isPayable = !isDue && (totalDues < -0.01 || partyPayables > 0.01)`. If `totalDues === 0` and `partyPayables > 0`, `isPayable` is true and `payableAmt = partyPayables`. A customer with ₹5,000 due and ₹5,000 credit (net 0) is displayed as "Store Payable: ₹5,000".
- **Data Flow Breakdown**:
  1. Customer owes ₹5,000 for tiles and has ₹5,000 store credit. Net balance is ₹0.
  2. Mobile drawer displays "Store Payable: ₹5,000".
  3. Store clerk mistakenly disburses ₹5,000 cash to customer.
- **Proposed Fix**:
  - **Mobile & Web**: Enforce net evaluation:
    `const isDue = totalDues > 0.01;`
    `const isPayable = totalDues < -0.01;`
    `const payableAmt = isPayable ? Math.abs(totalDues) : 0;`.
    In directory filters, classify `PAYABLES` strictly when `due < -EPSILON`.

---

#### ISS-32: Credit Ageing Defaulting to 0–15 Days Bucket Due to Null `dueDate` Fallback
- **Locations**:
  - Mobile: `mobile-app/src/components/parties/CreditAgeingRow.tsx:32–40`
  - Web: `web-dashboard/appWeb/dashboard/parties/page.tsx:172–177`
  - Backend: `backend/src/invoices/invoices.service.ts:584`
- **Root Cause & Trigger Conditions**:
  When `CreditLedger` is created on credit sales, `dueDate` is left `null`. The frontend fallback logic uses:
  `const dueTime = cl.dueDate ? new Date(cl.dueDate).getTime() : nowTime;`.
  Because `nowTime - nowTime = 0`, `daysOverdue = 0`. All receivables remain in "0–15 Days" forever.
- **Data Flow Breakdown**:
  1. Customer debt created 120 days ago with `dueDate: null`.
  2. Web and Mobile credit ageing report calculates `daysOverdue = 0`.
  3. Debt appears in "0–15 Days" bucket instead of "90+ Days", concealing chronic bad debt.
- **Proposed Fix**:
  - **Frontend**: Fall back to `cl.createdAt`:
    `const baseDate = cl.dueDate ? new Date(cl.dueDate).getTime() : new Date(cl.createdAt).getTime();`
    `const daysOverdue = Math.max(0, Math.floor((nowTime - baseDate) / 86400000));`.
  - **Backend**: Set default `dueDate` (`createdAt + 30 days`) during `CreditLedger` creation.

---

#### ISS-33: Distorted "Total Collected" Metric Depressed by Vendor Procurement Disbursements
- **Locations**:
  - Backend: `backend/src/payments/payments.service.ts:1319–1327` (`getStats`)
  - Web: `web-dashboard/appWeb/dashboard/page.tsx:95–115`
  - Mobile: `mobile-app/src/components/payments/PaymentStatsRow.tsx:51–63`
- **Root Cause & Trigger Conditions**:
  In `getStats()`, `totalCollected` is calculated as `Math.max(0, inflowAgg._sum.amount - outflowAgg._sum.amount)`. `outflowAgg` includes all vendor purchase payouts.
- **Data Flow Breakdown**:
  1. Cashier collects ₹5,00,000 from customer sales.
  2. Owner pays ₹4,50,000 to tile manufacturer for inventory.
  3. Daily Payment Stats displays "Total Collected: ₹50,000".
- **Proposed Fix**:
  - **Backend**: Compute `totalCollected` as customer sales inflows minus customer refund outflows. Display vendor procurement disbursements under a separate KPI (`totalDisbursed` / `vendorPayouts`).

---

#### ISS-34: Unpaid Invoices Missing from Party Directory Dues Calculations
- **Locations**:
  - Backend: `backend/src/parties/parties.service.ts:149–166` (`findAll`)
  - Mobile: `mobile-app/src/components/parties/partyRows.ts:41–49`
- **Root Cause & Trigger Conditions**:
  `findAll` only includes `creditLedgers`. Invoices created under payment modes other than `CREDIT` that remain partially paid do not generate credit ledgers and are omitted from party list due balances.
- **Data Flow Breakdown**:
  1. Customer purchases ₹20,000 with mode `CASH`, pays ₹5,000. Balance is ₹15,000. No `CreditLedger` row.
  2. Customer Directory displays `Due: ₹0.00`.
- **Proposed Fix**:
  - **Backend**: In `parties.service.ts:findAll`, include unpaid invoice balances via subquery or include un-ledgared invoice dues in party balance summary.
  - **Mobile App**: Harmonize `partyRows.ts` to reflect un-ledgared invoice dues.

---

#### ISS-35: Missing Returns and Debit Notes in Party Statement Drawer and `findOne`
- **Locations**:
  - Backend: `backend/src/parties/parties.service.ts:202–281` (`findOne`)
  - Web: `web-dashboard/componentsWeb/parties/party-statement-drawer.tsx:141–168`
  - Mobile: `mobile-app/src/components/parties/PartyStatementDrawer.tsx:110–145`
- **Root Cause & Trigger Conditions**:
  `findOne` omits relations `refundInvoices` and `debitNotes`. The statement drawer has no tabs or records for returns and calculates invoice dues without subtracting credit notes.
- **Proposed Fix**:
  - **Backend**: Include `refundInvoices` (with items and payments) and `debitNotes` in `findOne`.
  - **Web & Mobile**: Add dedicated tabs/views for Returns and Debit Notes in Statement Drawers and deduct refunds from displayed invoice dues.

---

#### ISS-36: Complete Absence of Credit Limit Tracking and Policy Enforcement
- **Locations**:
  - Backend Schema: `backend/prisma/schema.prisma:178–200`
  - Backend Service: `backend/src/invoices/invoices.service.ts:480–520`
  - Web: `web-dashboard/componentsWeb/parties/edit-party-modal.tsx:40–70`
  - Mobile: `mobile-app/src/components/parties/PartyStatementDrawer.tsx:80–105`
- **Root Cause & Trigger Conditions**:
  The `Party` model contains no `creditLimit` field. Salesmen can create unlimited credit invoices for parties with tens of lakhs in overdue debt.
- **Proposed Fix**:
  - **Backend**: Add `creditLimit Decimal @default(0) @db.Decimal(12, 2)` to `Party` model. In `invoices.service.ts`, validate `currentOutstanding + newCredit <= party.creditLimit` before creating credit invoices (allow Admin/Owner override).
  - **Web & Mobile**: Add Credit Limit input to Party edit modals and render credit utilization progress bars.

---

### Domain 4: Analytics, Financial Reporting, Delivery & Stock Audits (Issues ISS-37 to ISS-48)

#### ISS-37: Double Deduction of Revenue on 100% Invoice Return / Cancellation
- **Locations**:
  - Backend: `backend/src/analytics/analytics.service.ts:98–103, 174–177, 860–866`
  - Backend: `backend/src/invoices/invoices.service.ts:1304–1315`
  - Web: `web-dashboard/componentsWeb/analytics/analytics-kpi-grid.tsx:27–50`
  - Mobile: `mobile-app/src/components/dashboard/owner/ExecutiveKpiGrid.tsx:30–55`
- **Root Cause & Trigger Conditions**:
  When an invoice is 100% returned, `invoices.service.ts` sets `status = CANCELLED`. `revenueAgg` excludes `CANCELLED` invoices, removing the total from gross sales. Concurrently, `periodRefundAgg` sums all `refundInvoice.total`. Calculating `revenueAgg - periodRefundAgg` subtracts the invoice value twice.
- **Data Flow Breakdown**:
  1. Invoice 1 created for ₹50,000. Customer returns 100%; invoice marked `CANCELLED`. Refund = ₹50,000.
  2. Invoice 2 created for ₹50,000 (kept).
  3. `revenueAgg` sums Invoice 2 = ₹50,000 (Invoice 1 excluded).
  4. `periodRefundAgg` sums refund = ₹50,000.
  5. `totalRevenue = 50,000 - 50,000 = ₹0`. Store made ₹50,000 net, but KPI shows ₹0.
- **Proposed Fix**:
  - **Backend**: In `analytics.service.ts`, aggregate refunds only for non-cancelled original invoices:
    `originalInvoice: { status: { notIn: [CANCELLED, DRAFT] } }`. Alternatively, use `InvoiceStatus.RETURNED` for returned invoices so they remain in gross sales while refunds offset them cleanly.
  - **Web & Mobile**: Render Gross Invoiced, Returns, and Net Revenue distinctly.

---

#### ISS-38: Salesman Revenue & Staff Performance Ignores Returns Completely
- **Locations**:
  - Backend: `backend/src/analytics/analytics.service.ts:318–348, 657–664, 860–866`
  - Web: `web-dashboard/componentsWeb/analytics/salesmen-performance-table.tsx:70–140`
  - Mobile: `mobile-app/src/components/dashboard/owner/SalesStaffPerformance.tsx:40–75`
- **Root Cause & Trigger Conditions**:
  Staff performance queries perform `SELECT "salesmanId", SUM(total) FROM "Invoice" ... GROUP BY "salesmanId"` without joining `RefundInvoice`. In `getDashboard()`, `currentRevenue` for salesmen explicitly bypasses `periodRefundAgg`.
- **Data Flow Breakdown**:
  1. Salesman sells ₹5,00,000; customer returns ₹3,00,000. Net store sales = ₹2,00,000.
  2. Salesman performance board credits salesman with ₹5,00,000.
- **Proposed Fix**:
  - **Backend**: In `getSalesmanPerformance()`, left join `RefundInvoice` and compute net sales:
    `ROUND(COALESCE(SUM(i.total), 0) - COALESCE(SUM(rf.total), 0))::int AS total`.
    Allow salesmen to subtract their linked `periodRefundAgg` in `getDashboard()`.
  - **Web & Mobile**: Display "Net Sales" and "Returns Deducted" columns.

---

#### ISS-39: Receivables & Payables Discrepancy Between Analytics, Party Balances, and Invoices
- **Locations**:
  - Backend: `backend/src/analytics/analytics.service.ts:123–129, 590–623, 736–766`
  - Backend: `backend/src/parties/parties.service.ts:309–348`
  - Web: `web-dashboard/componentsWeb/analytics/receivables-health-card.tsx:39–70`
  - Mobile: `mobile-app/src/components/dashboard/owner/ReceivablesHealthCard.tsx:35–65`
- **Root Cause & Trigger Conditions**:
  `analytics.service.ts` calculates `receivablesTotal` solely from `CreditLedger WHERE type = 'RECEIVABLE'`. Unpaid invoices with non-credit payment modes are omitted, whereas `parties.service.ts` calculates `unpaidInvoiceDue`.
- **Data Flow Breakdown**:
  1. Cash invoice of ₹30,000 has ₹10,000 unpaid balance. No `CreditLedger` created.
  2. Party statement shows ₹10,000 due.
  3. Analytics executive board shows ₹0 receivables.
- **Proposed Fix**:
  - **Backend**: Harmonize analytics receivables calculation with `parties.service.ts` by including unpaid non-credit invoice balances. Ensure all unpaid invoices maintain a linked `CreditLedger`.

---

#### ISS-40: Credit Overdue Aging Always Shows ₹0 Due to Missing Dynamic State Calculation
- **Locations**:
  - Backend: `backend/src/analytics/analytics.service.ts:754–766, 1013–1016`
  - Web: `web-dashboard/componentsWeb/analytics/receivables-health-card.tsx:61–69`
  - Mobile: `mobile-app/src/components/dashboard/owner/ReceivablesHealthCard.tsx:50–70`
- **Root Cause & Trigger Conditions**:
  `analytics.service.ts` groups `CreditLedger` by `status = 'OVERDUE'`. No cron job or database trigger ever transitions status to `OVERDUE`. Overdue always evaluates to 0.
- **Data Flow Breakdown**:
  1. ₹10,00,000 of receivables are 60 days past due date.
  2. Database status remains `UNPAID`.
  3. Analytics dashboard reports `Overdue Balances: ₹0.00`.
- **Proposed Fix**:
  - **Backend**: Calculate aging dynamically in SQL:
    `CASE WHEN status != 'SETTLED' AND "dueDate" IS NOT NULL AND "dueDate" < NOW() THEN 'OVERDUE' ELSE status END AS dynamic_status`. Provide standard aging buckets (0–30, 31–60, 61–90, 90+ days).
  - **Web & Mobile**: Render aging breakdown buckets in `ReceivablesHealthCard`.

---

#### ISS-41: Historical Daily Credit Trend Evaporates As Customers Pay Debts
- **Locations**:
  - Backend: `backend/src/analytics/analytics.service.ts:790–801, 962–967`
  - Web: `web-dashboard/componentsWeb/analytics/revenue-cashflow-chart.tsx:28–55`
- **Root Cause & Trigger Conditions**:
  `trendCreditsRaw` queries `SUM("amountDue")` grouped by `createdAt`. When debt is settled, `amountDue` becomes 0, retroactively zeroing past credit points on historical charts.
- **Data Flow Breakdown**:
  1. On Oct 1, ₹1,00,000 credit extended. Chart shows ₹1,00,000 credit bar.
  2. On Oct 15, customer pays debt. `amountDue` becomes 0.
  3. On Oct 20, viewing Oct 1 chart displays ₹0 credit extended.
- **Proposed Fix**:
  - **Backend**: In `trendCreditsRaw`, aggregate original credit extended (`Invoice.total - upfrontPayment`) or add an immutable `originalAmount` column on `CreditLedger`.

---

#### ISS-42: Category Breakdown and Revenue Trend Ignore Sales Returns
- **Locations**:
  - Backend: `backend/src/analytics/analytics.service.ts:258–275, 691–707, 767–775`
  - Web: `web-dashboard/componentsWeb/analytics/payment-category-breakdown.tsx:35–65`
  - Web: `web-dashboard/componentsWeb/analytics/revenue-cashflow-chart.tsx:40–70`
- **Root Cause & Trigger Conditions**:
  `categorySplitRaw` queries `InvoiceItem` without subtracting returned quantities from `RefundInvoiceItem`. `trendInvoicesRaw` sums `Invoice.total` without subtracting returns on that day.
- **Data Flow Breakdown**:
  1. ₹2,00,000 of Sanitaryware sold and subsequently returned.
  2. Category chart displays Sanitaryware = ₹2,00,000. Trend line shows ₹2,00,000 gross.
- **Proposed Fix**:
  - **Backend**: In `categorySplitRaw`, subtract returned items via CTE joining `RefundInvoiceItem`. In `trendInvoicesRaw`, subtract daily refunds.

---

#### ISS-43: GST Reporting Discrepancies (Returns, Discounts, Draft Filter Bug in GSTR-1 / GSTR-3B)
- **Locations**:
  - Backend: `backend/src/analytics/analytics.service.ts:1273–1329`
  - Backend: `backend/src/analytics/analytics.controller.ts:61–67`
  - Web: `web-dashboard/appWeb/dashboard/day-book/page.tsx:180–220`
- **Root Cause & Trigger Conditions**:
  `getGstReports` filters `status: { not: InvoiceStatus.CANCELLED }`, which includes `DRAFT` invoices. `taxable` is calculated as `subtotal + transportCost`, omitting `discountAmount`. Credit notes and debit notes are completely omitted.
- **Data Flow Breakdown**:
  1. Draft invoice of ₹5,00,000 created.
  2. Invoices with discounts and credit notes exist.
  3. GST report exports inflated turnover including drafts and ignoring credit notes.
- **Proposed Fix**:
  - **Backend**: Filter `status: { notIn: [CANCELLED, DRAFT] }`. Deduct `discountAmount` from taxable turnover. Query `RefundInvoice` (Credit Notes) and subtract from GSTR-1 outward supplies. Adjust GSTR-3B with debit note ITC reversals.

---

#### ISS-44: Deliveries Cannot Be Cancelled & Lack Desync Protection on Invoice Cancellation/Return
- **Locations**:
  - Backend: `backend/src/delivery/delivery.service.ts:446–451`
  - Backend: `backend/src/invoices/invoices.service.ts:1290–1328`
  - Web: `web-dashboard/componentsWeb/deliveries/push-delivery-modal.tsx:60–90`
  - Mobile: `mobile-app/src/app/(tabs)/deliveries.tsx:85–115`
- **Root Cause & Trigger Conditions**:
  `delivery.service.ts:447` throws `BadRequestException` if `status === DeliveryStatus.CANCELLED`. When an invoice is returned or cancelled, `invoices.service.ts` restocks items but never cancels or updates active deliveries.
- **Data Flow Breakdown**:
  1. Invoice created; delivery order generated in `PENDING`.
  2. Customer cancels order. Return processed; goods restocked in godown.
  3. Delivery remains in `PENDING` on Dispatch Board. Driver loads restocked goods and delivers them. Goods lost.
- **Proposed Fix**:
  - **Backend**: Allow `DeliveryStatus.CANCELLED`. In `invoices.service.ts:1310` (`processReturn`), automatically cancel active non-delivered deliveries for the invoice.
  - **Web & Mobile**: Render "Cancelled" badge on deliveries and block dispatch actions.

---

#### ISS-45: Driver Cash Shortfall Punishes Customer with Phantom Debt
- **Locations**:
  - Backend: `backend/src/delivery/delivery.service.ts:1021–1030, 1060–1155`
  - Backend: `backend/src/payments/payments.service.ts:249–270`
  - Web: `web-dashboard/appWeb/dashboard/deliveries/page.tsx:280–300`
  - Mobile: `mobile-app/src/components/deliveries/CollectCashModal.tsx:75–105`
- **Root Cause & Trigger Conditions**:
  When a driver hands over less cash than collected, `handoverCash` records only the `effectiveCash` as invoice payment. The remaining shortfall stays on the invoice, updating status to `PARTIAL` and creating a `CreditLedger` receivable against the customer.
- **Data Flow Breakdown**:
  1. Customer pays ₹10,000 cash to driver on delivery.
  2. Driver loses ₹2,000; hands over ₹8,000.
  3. Manager records ₹8,000 handover. Customer is billed ₹2,000 as unpaid debt.
- **Proposed Fix**:
  - **Backend**: When `overrideAmount < collectedNum`, credit the customer's invoice for the full amount paid (`collectedNum`). Record the shortfall as a driver shortage expense (`Expense: CASH_SHORTAGE`).
  - **Web Dashboard**: Provide explicit radio buttons in handover modal: "Customer Paid Full, Driver Short" vs "Customer Underpaid Driver".

---

#### ISS-46: Multi-Delivery & Split Dispatch Desyncs `amountToCollect` Across Drivers
- **Locations**:
  - Backend: `backend/src/delivery/delivery.service.ts:806–838`
  - Backend: `backend/src/payments/payments.service.ts:249–257`
  - Web: `web-dashboard/componentsWeb/deliveries/push-delivery-modal.tsx:110–140`
  - Mobile: `mobile-app/src/components/deliveries/DeliveryCard.tsx:65–90`
- **Root Cause & Trigger Conditions**:
  When partial deliveries are pushed, `existingPending` delivery only has its `items` updated, leaving `amountToCollect` stale. Later, `reconcilePartyFinancials` in `payments.service.ts` updates ALL active deliveries for that invoice with `amountToCollect = remainingDue`, causing multiple drivers to each demand the full balance.
- **Data Flow Breakdown**:
  1. Invoice balance = ₹40,000. Dispatched in 2 truck loads.
  2. Auto-healing updates both Driver 1 and Driver 2 to collect ₹40,000 each.
  3. Both drivers demand ₹40,000 from customer.
- **Proposed Fix**:
  - **Backend**: In `pushDelivery`, apportion `amountToCollect` between current dispatch and pending delivery. In `reconcilePartyFinancials`, do not execute bulk `updateMany` setting `amountToCollect = remainingDue` across all active deliveries.
  - **Web Dashboard**: In `PushDeliveryModal`, require explicit allocation of `amountToCollect` per trip.

---

#### ISS-47: 30-Minute Cache Stale-Out on Dashboard & Delivery Actions (Zero Invalidation in Delivery)
- **Locations**:
  - Backend: `backend/src/analytics/analytics.service.ts:79–80, 355–356, 1063–1064`
  - Backend: `backend/src/delivery/delivery.service.ts:73–77, 951–1187`
  - Web: `web-dashboard/appWeb/dashboard/page.tsx:130–136`
  - Mobile: `mobile-app/src/app/(tabs)/index.tsx:85–94`
- **Root Cause & Trigger Conditions**:
  `analytics.service.ts` caches summaries, dashboards, and day-book for 1800 seconds (30 minutes). `delivery.service.ts` does not inject `CacheService` and never invalidates cache prefixes on cash collection or handover.
- **Data Flow Breakdown**:
  1. Driver collects ₹20,000 cash; manager clicks "Collect Cash" on Web Dashboard.
  2. Backend performs handover in database.
  3. Dashboard re-fetches; backend returns 30-minute cached JSON. Delivery still appears in awaiting handover queue.
- **Proposed Fix**:
  - **Backend**: Inject `CacheService` into `delivery.service.ts`. Invalidate `analytics:`, `deliveries:`, `payments:`, and `invoices:` prefixes in `collectCash`, `handoverCash`, `pushDelivery`, and `updateStatus`. Lower operational analytics cache TTL to 60–120 seconds.
  - **Web Dashboard**: Optimistically remove handed-over deliveries from state on success.

---

#### ISS-48: Missing Security Role Guards on Driver Cash Collection Endpoint
- **Locations**:
  - Backend: `backend/src/delivery/delivery.controller.ts:166–178`
  - Backend: `backend/src/delivery/delivery.service.ts:951–965`
- **Root Cause & Trigger Conditions**:
  `@Patch(':id/collect-cash')` lacks a `@Roles(...)` decorator, and `delivery.service.ts` does not verify driver assignment ownership.
- **Data Flow Breakdown**:
  1. Any authenticated user or Driver A sends PATCH request to `/delivery/<driver_b_id>/collect-cash`.
  2. Endpoint accepts request without ownership verification.
- **Proposed Fix**:
  - **Backend**: Add `@Roles(Role.DRIVER, Role.ADMIN, Role.OWNER)` to `collectCash` in `delivery.controller.ts`. In `delivery.service.ts:957`, verify `actor.role !== Role.DRIVER || delivery.driverId === actor.id`.

---

## 3. Cross-Cutting Execution Phases & Priority Matrix

To execute these fixes safely in a production environment without causing downtime or secondary bugs, all 48 issues are partitioned into 5 cross-cutting phases governed by strict dependency ordering:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Financial Ledger, Status & Double Credit Auto-Healing (P0)      │
│ Issues: ISS-01, ISS-04, ISS-08, ISS-15, ISS-18, ISS-24, ISS-26, ISS-27, │
│         ISS-28, ISS-29, ISS-30                                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Inventory & Multi-Warehouse Tracking Alignment (P0)            │
│ Issues: ISS-05, ISS-06, ISS-12, ISS-14, ISS-44                          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Transaction Relations, Salesman Filtering & Debit Notes (P1)   │
│ Issues: ISS-02, ISS-07, ISS-13, ISS-16, ISS-17, ISS-19, ISS-20, ISS-23, │
│         ISS-35, ISS-36, ISS-48                                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Analytics, GST Compliance & Delivery Synchronization (P1)      │
│ Issues: ISS-10, ISS-25, ISS-33, ISS-37, ISS-38, ISS-39, ISS-40, ISS-41, │
│         ISS-42, ISS-43, ISS-45, ISS-46, ISS-47                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 5: Frontend UI/UX Math, Truncation & Presentation Fixes (P2)      │
│ Issues: ISS-03, ISS-09, ISS-11, ISS-21, ISS-22, ISS-31, ISS-32, ISS-34 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Detailed Phase Specifications

#### Phase 1: Financial Ledger, Status & Double Credit Auto-Healing (Critical P0)
- **Goal**: Establish rock-solid financial truth across customer and vendor double-entry credit ledgers, stop phantom credit creation, eliminate FIFO payment hijacking, and correct payment status lifecycles.
- **Affected Services**: `backend/src/payments/`, `backend/src/invoices/`, `backend/src/purchases/`, `backend/src/parties/`.
- **Target Issues**: ISS-01, ISS-04, ISS-08, ISS-15, ISS-18, ISS-24, ISS-26, ISS-27, ISS-28, ISS-29, ISS-30.
- **Key Changes**:
  1. Remove `refundInvoiceId: null` exclusion in `invoices.service.ts` and `payments.service.ts`.
  2. Implement partitioned payment allocation in `reconcilePartyFinancials`: earmarked payments remain bound to their invoice; unallocated payments settle FIFO.
  3. Stop duplicate credit creation in `reconcilePartyFinancials` for return store credits.
  4. Ensure `confirmPayment` updates invoice/purchase statuses, delivery amounts, and triggers reconciliation.
  5. Calculate initial `status` on purchases (`PAID` when fully settled upfront).
  6. In `deletePayment`, restore settled credit ledgers for vendor purchases and revert purchase status.
  7. In `deleteReturn`, restore receivable debts on the original invoice credit ledger.
  8. Unify opening balance regex pattern.

#### Phase 2: Inventory & Multi-Warehouse Tracking Alignment (Critical P0)
- **Goal**: Ensure that all physical goods inwarded or outwarded match physical godown distribution, batch numbers are preserved, and debit notes outward inventory.
- **Affected Services**: `backend/src/purchases/`, `backend/src/invoices/`, `backend/prisma/schema.prisma`.
- **Target Issues**: ISS-05, ISS-06, ISS-12, ISS-14, ISS-44.
- **Key Changes**:
  1. Add `DebitNoteItem` to schema (or purchase return line items) and outward `StockLedger` on debit notes.
  2. Remove hardcoded `warehouseId: null, batchNo: null` in `purchases.service.ts:361, 386`. Scoped `StockLedger` queries by `productId, warehouseId, batchNo`.
  3. Accept `warehouseId` on invoice returns and update target warehouse stock.
  4. Preserve `batchNo` on `RefundInvoiceItem` and validate returns by `invoiceItemId`.
  5. Auto-cancel pending deliveries when invoices are returned/cancelled.

#### Phase 3: Transaction Relations, Salesman Filtering & Debit Note Parity (High P1)
- **Goal**: Ensure complete audit trails, eliminate cash drawer blindspots for salesmen, prevent uncapped debit notes, and enable debit note functionality on mobile.
- **Affected Services**: `backend/src/payments/`, `backend/src/purchases/`, `web-dashboard/`, `mobile-app/`.
- **Target Issues**: ISS-02, ISS-07, ISS-13, ISS-16, ISS-17, ISS-19, ISS-20, ISS-23, ISS-35, ISS-36, ISS-48.
- **Key Changes**:
  1. Add `createdById` on payments; expand salesman filter to include standalone return payouts and user-created payments.
  2. Cap debit note creation at `purchase.total - priorDebitNotes`.
  3. Add `purchaseId` to `CreatePaymentDto` and link vendor payments to purchases.
  4. Validate return unit prices (`unitPrice <= purchasedUnitPrice`) and prorate discounts.
  5. Prevent deletion of purchases with confirmed payments.
  6. Include `debitNotes: true` in `purchases.service.ts:findAll`.
  7. Build `CreateDebitNoteModal.tsx` in `mobile-app/` and expose debit notes.
  8. Add `creditLimit` to `Party` and enforce limits during invoice creation.
  9. Add role guards and driver ownership check on `collect-cash`.

#### Phase 4: Analytics, GST Compliance & Delivery Synchronization (High P1)
- **Goal**: Correct financial KPIs, align tax reporting with Indian GST statutory requirements, fix driver cash shortfall billing, and eliminate cache stale-out.
- **Affected Services**: `backend/src/analytics/`, `backend/src/delivery/`, `web-dashboard/`, `mobile-app/`.
- **Target Issues**: ISS-10, ISS-25, ISS-33, ISS-37, ISS-38, ISS-39, ISS-40, ISS-41, ISS-42, ISS-43, ISS-45, ISS-46, ISS-47.
- **Key Changes**:
  1. Stop double-deducting revenue on 100% returns in `analytics.service.ts`.
  2. Subtract sales returns from salesman performance metrics.
  3. Include unpaid non-credit invoices in analytics receivables calculation.
  4. Dynamically compute credit overdue aging using SQL date arithmetic.
  5. Adjust GSTR-1 and GSTR-3B queries: deduct discounts, subtract credit notes, reverse debit note ITC, exclude drafts.
  6. Credit customer invoices fully when driver is short on cash; record driver shortage under `Expense: CASH_SHORTAGE`.
  7. Apportion `amountToCollect` across split deliveries.
  8. Inject `CacheService` into `delivery.service.ts` and invalidate cache prefixes on logistics events.

#### Phase 5: Frontend UI/UX Math, Truncation & Presentation Fixes (Medium P2)
- **Goal**: Eliminate client-side math bugs, quantity truncation, presentation inversions, and static QR limitations.
- **Affected Components**: `web-dashboard/componentsWeb/`, `mobile-app/src/components/`.
- **Target Issues**: ISS-03, ISS-09, ISS-11, ISS-21, ISS-22, ISS-31, ISS-32, ISS-34.
- **Key Changes**:
  1. Change `payment.mode !== 'OUTFLOW'` to `payment.type === 'INFLOW'` in web invoice drawer and WhatsApp share.
  2. Use stored `invoice.previousBalance` on historical invoice PDF reprints.
  3. Set dynamic `balanceDue` on UPI QR codes.
  4. Filter `c.type === 'PAYABLE'` in mobile `getPurchaseDueAmount`.
  5. Replace `parseInt` with `parseFloat` in mobile purchase subtotal.
  6. Display net liability in mobile/web party drawers; fix directory `PAYABLES` filter.
  7. Fall back to `cl.createdAt` in mobile/web credit ageing when `dueDate` is null.
  8. Include un-ledgared invoice dues in mobile party directory rows.

---

## 4. Verification & Validation Protocol

### 4.1 Safe Simulation & Testing Framework (Zero Production DB Mutation)
All verification procedures must strictly comply with the Production Safety Mandate:
- **Zero Live Mutations**: No ad-hoc write queries or migrations executed directly on production PostgreSQL.
- **Staging / Local Test Harness**: Verification tests must run against isolated test databases or local docker instances initialized with sanitized mock datasets.
- **Fast-Verify Low-Token TypeScript Checks**: Execute `scripts/fast-verify.ps1` or `npx tsc --noEmit` across subdirectories to ensure 100% type safety before test runs.

### 4.2 Phase-by-Phase Acceptance Test Cases

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   PHASE 1 ACCEPTANCE TEST SUITE                         │
├──────────────────────────────────────────────────────────────────────────┤
│ Test TC-P1-01: Store Credit Offsetting on New Invoices                  │
│ 1. Seed Party P1 with Invoice INV-01 (₹5,000, Settled).                  │
│ 2. Process Return for INV-01 for ₹2,000 with refundMode: CREDIT.        │
│ 3. Create Invoice INV-02 for Party P1 for ₹4,000.                        │
│ 4. Assert: INV-02 balanceDue is ₹2,000 (₹2,000 Store Credit deducted).   │
│ 5. Assert: Party P1 store credit ledger status transitions to SETTLED.   │
├──────────────────────────────────────────────────────────────────────────┤
│ Test TC-P1-02: Zero Double Credit on Auto-Healing                        │
│ 1. Trigger `reconcilePartyFinancials` for Party P1.                      │
│ 2. Assert: Total PAYABLE credit ledgers for Party P1 equal ₹0 (no phantom│
│    duplicate "Advance customer balance" created).                        │
├──────────────────────────────────────────────────────────────────────────┤
│ Test TC-P1-03: Earmarked Payment Protection                              │
│ 1. Party P2 has Invoice INV-A (₹10,000, unpaid, createdAt: Day 1).       │
│ 2. Party P2 creates Invoice INV-B (₹15,000, createdAt: Day 2).          │
│ 3. Record payment of ₹15,000 with invoiceId: 'INV-B'.                    │
│ 4. Trigger auto-healing / reconciliation.                                │
│ 5. Assert: INV-B remains status: PAID, balanceDue: ₹0.                   │
│ 6. Assert: INV-A remains status: PARTIAL/CREATED, balanceDue: ₹10,000.   │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                   PHASE 2 ACCEPTANCE TEST SUITE                         │
├──────────────────────────────────────────────────────────────────────────┤
│ Test TC-P2-01: Debit Note Physical Stock Decrement                       │
│ 1. Create Purchase PUR-01 with 50 boxes of Tile X at Warehouse W1.       │
│ 2. Assert: StockLedger(Tile X, W1) quantity = 50.                        │
│ 3. Issue Debit Note DN-01 for 10 boxes of Tile X at Warehouse W1.        │
│ 4. Assert: StockLedger(Tile X, W1) quantity = 40.                        │
│ 5. Assert: Audit log entry logged: DEBIT_NOTE_STOCK_OUTWARD.             │
├──────────────────────────────────────────────────────────────────────────┤
│ Test TC-P2-02: Batched Return Over-Return Immunity                       │
│ 1. Invoice INV-10 sells 10 boxes of Tile Y with batchNo: 'BATCH-A'.      │
│ 2. Return 10 boxes of Tile Y with batchNo: 'BATCH-A'.                    │
│ 3. Attempt second return of 5 boxes of Tile Y on INV-10.                 │
│ 4. Assert: Throws BadRequestException ('No returnable quantity').        │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                   PHASE 3 ACCEPTANCE TEST SUITE                         │
├──────────────────────────────────────────────────────────────────────────┤
│ Test TC-P3-01: Salesman Transaction Visibility                           │
│ 1. Salesman S1 processes standalone cash return of ₹500.                 │
│ 2. Call GET /payments as Salesman S1.                                    │
│ 3. Assert: Payment record is present with type: OUTFLOW, amount: 500.    │
├──────────────────────────────────────────────────────────────────────────┤
│ Test TC-P3-02: Debit Note Amount Capping                                 │
│ 1. Purchase PUR-20 total = ₹30,000. Prior debit notes = ₹10,000.         │
│ 2. Attempt Debit Note for ₹25,000.                                       │
│ 3. Assert: Throws BadRequestException (cannot exceed remaining ₹20,000). │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                   PHASE 4 ACCEPTANCE TEST SUITE                         │
├──────────────────────────────────────────────────────────────────────────┤
│ Test TC-P4-01: Revenue Metric on 100% Return                             │
│ 1. Invoice INV-30 = ₹1,00,000. 100% returned and marked RETURNED.       │
│ 2. Invoice INV-31 = ₹1,00,000 (settled).                                 │
│ 3. Query GET /analytics/summary.                                         │
│ 4. Assert: totalRevenue = ₹1,00,000 (not ₹0).                            │
├──────────────────────────────────────────────────────────────────────────┤
│ Test TC-P4-02: Driver Shortfall Charged to Expense, Not Customer         │
│ 1. Delivery collection amount = ₹5,000. Cash collected = ₹5,000.         │
│ 2. Driver hands over ₹4,000 (shortfall ₹1,000).                          │
│ 3. Execute handoverCash with overrideAmount = 4000.                      │
│ 4. Assert: Invoice balance due = ₹0.                                     │
│ 5. Assert: Expense record created for ₹1,000 under CASH_SHORTAGE.        │
│ 6. Assert: Customer CreditLedger balanceDue is NOT incremented.          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                   PHASE 5 ACCEPTANCE TEST SUITE                         │
├──────────────────────────────────────────────────────────────────────────┤
│ Test TC-P5-01: Web Drawer Paid Amount Inversion Fix                      │
│ 1. Invoice of ₹10,000 with ₹10,000 INFLOW and ₹2,000 OUTFLOW cash refund.│
│ 2. Mount `invoice-details-drawer.tsx`.                                   │
│ 3. Assert: Paid Amount renders as ₹10,000 (or Net Paid ₹8,000).          │
│ 4. Assert: Paid Amount NEVER renders as ₹12,000.                         │
├──────────────────────────────────────────────────────────────────────────┤
│ Test TC-P5-02: Mobile Decimal Quantity Precision                         │
│ 1. Input 12.75 boxes at ₹1,000 in mobile `CreatePurchaseModal.tsx`.      │
│ 2. Assert: Subtotal evaluates to ₹12,750 (not ₹12,000).                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Architectural Recommendations & Post-Fix Hygiene

1. **Prisma Decimal Discipline**:
   Ensure all monetary and quantity calculations use `Prisma.Decimal` or decimal arithmetic libraries (`decimal.js`) rather than standard JavaScript floating-point numbers to prevent fractional cent rounding accumulation across large transactions.
2. **Transactional Event Boundaries**:
   Wrap cross-domain operations (e.g. Invoicing + Inventory + Credit Ledger + Delivery) inside strict `prisma.$transaction` blocks with row-level locks (`SELECT ... FOR UPDATE`) on `StockLedger` and `CreditLedger` to eliminate race conditions under concurrent cashier operations.
3. **Automated Continuous Audit Verification**:
   Deploy an asynchronous nightly audit job (`AuditCronService`) that validates:
   - `SUM(confirmedInflows) - SUM(confirmedOutflows) == LedgerCashBalance`
   - `SUM(stockLedger.quantity) == PhysicalInventoryCount`
   - `SUM(invoice.total - returns - payments) == receivablesTotal`
   Any discrepancy triggers an immediate high-priority alert to the executive board.

---
*End of Fix Plan. Authored and synthesized by Teamwork Engineering for dhraERP.*
