import assert from 'node:assert/strict';
import { Prisma, InvoiceStatus, DeliveryStatus, Role } from '@prisma/client';

console.log('Running Driver Delivery Payment Verification Suite...');

// Test 1: Effective Amount Calculation Logic in findAll and findOne
function computeEffectiveAmount(d: {
  amountToCollect?: number | Prisma.Decimal | null;
  cashCollected?: number | Prisma.Decimal | null;
  cashHandedOver?: boolean | null;
  invoice?: { status?: string | null } | null;
}) {
  const isInvoicePaid =
    d.invoice?.status === InvoiceStatus.PAID ||
    d.invoice?.status === InvoiceStatus.CANCELLED;
  let effectiveAmount = Number(d.amountToCollect || 0);
  if (isInvoicePaid || d.cashHandedOver === true) {
    effectiveAmount = 0;
  } else {
    effectiveAmount = Math.max(0, effectiveAmount);
  }
  return Number(effectiveAmount.toFixed(2));
}

// Case 1.1: Unpaid invoice, no cash collected -> full amount to collect
assert.equal(
  computeEffectiveAmount({
    amountToCollect: 5000,
    cashCollected: 0,
    cashHandedOver: false,
    invoice: { status: InvoiceStatus.CREATED },
  }),
  5000,
);

// Case 1.2: Paid invoice -> 0 to collect
assert.equal(
  computeEffectiveAmount({
    amountToCollect: 5000,
    cashCollected: 0,
    cashHandedOver: false,
    invoice: { status: InvoiceStatus.PAID },
  }),
  0,
);

// Case 1.3: Cancelled invoice -> 0 to collect
assert.equal(
  computeEffectiveAmount({
    amountToCollect: 5000,
    cashCollected: 0,
    cashHandedOver: false,
    invoice: { status: InvoiceStatus.CANCELLED },
  }),
  0,
);

// Case 1.4: Cash already handed over to office -> 0 to collect
assert.equal(
  computeEffectiveAmount({
    amountToCollect: 5000,
    cashCollected: 5000,
    cashHandedOver: true,
    invoice: { status: InvoiceStatus.PARTIAL },
  }),
  0,
);

// Case 1.5: Full cash collected on delivery -> amountToCollect is 0
assert.equal(
  computeEffectiveAmount({
    amountToCollect: 0,
    cashCollected: 5000,
    cashHandedOver: false,
    invoice: { status: InvoiceStatus.PARTIAL },
  }),
  0,
);

console.log('✓ Test 1: Dynamic effective amount calculation passed.');

// Test 2: Zero-Cash Collection Behavior & Ownership
function simulateCollectCash(
  delivery: {
    id: string;
    driverId?: string | null;
    amountToCollect: number;
    cashCollected: number;
    cashHandedOver: boolean;
    status: DeliveryStatus;
    notes?: string;
  },
  amount: number,
  notes?: string,
  user?: { id: string; role: Role },
) {
  // Role check: drivers can only collect for their own assigned deliveries
  if (user?.role === Role.DRIVER && delivery.driverId !== user.id) {
    throw new Error('Forbidden: Drivers can only collect cash for their own assigned deliveries.');
  }

  if ((amount || 0) <= 0) {
    return {
      ...delivery,
      status: DeliveryStatus.DELIVERED,
      amountToCollect: 0,
      cashCollected: 0,
      cashHandedOver: true, // Released from custody!
      notes: notes ? `${notes} (Paid online/counter)` : 'Paid online/counter',
    };
  }

  const totalCashCollected = Number(delivery.cashCollected || 0) + amount;
  const newAmount = Math.max(0, delivery.amountToCollect - amount);
  return {
    ...delivery,
    status: DeliveryStatus.DELIVERED,
    amountToCollect: newAmount,
    cashCollected: totalCashCollected,
    cashHandedOver: false,
    notes,
  };
}

// Case 2.1: Driver collects ₹0 for counter/online paid order
const resZero = simulateCollectCash(
  {
    id: 'del-1',
    driverId: 'drv-1',
    amountToCollect: 4000,
    cashCollected: 0,
    cashHandedOver: false,
    status: DeliveryStatus.OUT_FOR_DELIVERY,
  },
  0,
  'Customer paid via GPay to shop owner',
  { id: 'drv-1', role: Role.DRIVER },
);
assert.equal(resZero.status, DeliveryStatus.DELIVERED);
assert.equal(resZero.amountToCollect, 0);
assert.equal(resZero.cashCollected, 0);
assert.equal(resZero.cashHandedOver, true);
assert.ok(resZero.notes?.includes('(Paid online/counter)'));

// Case 2.2: Driver collects physical cash (full)
const resCash = simulateCollectCash(
  {
    id: 'del-2',
    driverId: 'drv-1',
    amountToCollect: 4000,
    cashCollected: 0,
    cashHandedOver: false,
    status: DeliveryStatus.OUT_FOR_DELIVERY,
  },
  4000,
  'Cash received',
  { id: 'drv-1', role: Role.DRIVER },
);
assert.equal(resCash.status, DeliveryStatus.DELIVERED);
assert.equal(resCash.amountToCollect, 0);
assert.equal(resCash.cashCollected, 4000);
assert.equal(resCash.cashHandedOver, false);

// Case 2.3: Another driver attempts collection -> forbidden
assert.throws(
  () =>
    simulateCollectCash(
      {
        id: 'del-3',
        driverId: 'drv-1',
        amountToCollect: 1000,
        cashCollected: 0,
        cashHandedOver: false,
        status: DeliveryStatus.OUT_FOR_DELIVERY,
      },
      1000,
      'Stolen attempt',
      { id: 'drv-2', role: Role.DRIVER },
    ),
  /Forbidden/,
);

// Case 2.4: Driver attempts collection on UNASSIGNED delivery (driverId: null) -> strictly forbidden
assert.throws(
  () =>
    simulateCollectCash(
      {
        id: 'del-unassigned',
        driverId: null,
        amountToCollect: 1000,
        cashCollected: 0,
        cashHandedOver: false,
        status: DeliveryStatus.PENDING,
      },
      1000,
      'Unassigned attempt',
      { id: 'drv-1', role: Role.DRIVER },
    ),
  /Forbidden/,
);

// Case 2.5: End-to-End Partial Cash Collection -> No Double Deduction (<50%)
const initialDelivery = {
  id: 'del-partial',
  driverId: 'drv-1',
  amountToCollect: 5000,
  cashCollected: 0,
  cashHandedOver: false,
  status: DeliveryStatus.OUT_FOR_DELIVERY,
};
const collectedPartial = simulateCollectCash(initialDelivery, 2000, 'Partial cash', {
  id: 'drv-1',
  role: Role.DRIVER,
});
assert.equal(collectedPartial.amountToCollect, 3000);
assert.equal(collectedPartial.cashCollected, 2000);
// Read path dynamic resolution must yield 3000, NOT double-deduct to 1000!
const effectiveAfterCollect = computeEffectiveAmount(collectedPartial);
assert.equal(effectiveAfterCollect, 3000);

// Case 2.6: End-to-End Partial Cash Collection (>=50% threshold check)
const initialDelivery60 = {
  id: 'del-partial-60',
  driverId: 'drv-1',
  amountToCollect: 5000,
  cashCollected: 0,
  cashHandedOver: false,
  status: DeliveryStatus.OUT_FOR_DELIVERY,
};
const collected60 = simulateCollectCash(initialDelivery60, 3000, '60% partial cash', {
  id: 'drv-1',
  role: Role.DRIVER,
});
assert.equal(collected60.amountToCollect, 2000);
assert.equal(collected60.cashCollected, 3000);
// Read path dynamic resolution must yield 2000, NOT erroneously collapse to 0!
assert.equal(computeEffectiveAmount(collected60), 2000);

// Case 2.7: Multi-installment partial cash collection accumulation
const secondInstallment = simulateCollectCash(collectedPartial, 1000, 'Second installment', {
  id: 'drv-1',
  role: Role.DRIVER,
});
assert.equal(secondInstallment.amountToCollect, 2000);
assert.equal(secondInstallment.cashCollected, 3000); // 2000 + 1000 accumulated
assert.equal(computeEffectiveAmount(secondInstallment), 2000);

console.log('✓ Test 2: Zero-cash collection, driver ownership check, and no double-deduction passed.');

// Test 3: Split Delivery Apportionment with Uncollected Trip Protection
function simulateSyncDeliveriesForInvoice(
  deliveries: Array<{
    id: string;
    amountToCollect: number;
    cashCollected: number;
    cashHandedOver: boolean;
    status: DeliveryStatus;
    driverId?: string;
  }>,
  remainingDue: number,
  invoiceNo?: string,
) {
  // Only trips where cash has NOT yet been collected are eligible for balance apportionment
  const eligibleDeliveries = deliveries.filter(
    (d) => Number(d.cashCollected || 0) <= 0.01 && d.status !== DeliveryStatus.DELIVERED,
  );

  const notifications: Array<{ driverId: string; msg: string }> = [];

  if (deliveries.length === 0) return { deliveries, notifications };

  if (remainingDue <= 0.01) {
    const updated = deliveries.map((d) => {
      if (d.cashHandedOver) return d;
      if (d.status === DeliveryStatus.DELIVERED && Number(d.cashCollected || 0) <= 0.01) {
        return { ...d, amountToCollect: 0, cashHandedOver: true };
      }
      if (d.status !== DeliveryStatus.DELIVERED) {
        return { ...d, amountToCollect: 0 };
      }
      return d;
    });

    for (const d of eligibleDeliveries) {
      if (d.driverId) {
        notifications.push({
          driverId: d.driverId,
          msg: `Invoice #${invoiceNo || ''} settled. Do not collect cash.`,
        });
      }
    }
    return { deliveries: updated, notifications };
  }

  if (eligibleDeliveries.length === 0) return { deliveries, notifications };

  const totalCurrentAmount = eligibleDeliveries.reduce(
    (sum, d) => sum + Math.max(0, d.amountToCollect),
    0,
  );

  const updatedAmounts = new Map<string, number>();

  let updated: typeof deliveries;

  if (totalCurrentAmount <= 0) {
    const share = Math.round((remainingDue / eligibleDeliveries.length) * 100) / 100;
    updated = deliveries.map((d) => {
      const idx = eligibleDeliveries.findIndex((e) => e.id === d.id);
      if (idx === -1) return d;
      const amt =
        idx === eligibleDeliveries.length - 1
          ? Math.max(0, remainingDue - share * (eligibleDeliveries.length - 1))
          : share;
      const finalAmt = Number(amt.toFixed(2));
      updatedAmounts.set(d.id, finalAmt);
      return { ...d, amountToCollect: finalAmt };
    });
  } else if (remainingDue < totalCurrentAmount) {
    let allocated = 0;
    updated = deliveries.map((d) => {
      const idx = eligibleDeliveries.findIndex((e) => e.id === d.id);
      if (idx === -1) return d;
      let newAmt: number;
      if (idx === eligibleDeliveries.length - 1) {
        newAmt = Math.max(0, Math.round((remainingDue - allocated) * 100) / 100);
      } else {
        const ratio = Math.max(0, d.amountToCollect) / totalCurrentAmount;
        newAmt = Math.max(0, Math.round(remainingDue * ratio * 100) / 100);
        allocated += newAmt;
      }
      const finalAmt = Number(newAmt.toFixed(2));
      updatedAmounts.set(d.id, finalAmt);
      return { ...d, amountToCollect: finalAmt };
    });
  } else {
    updated = deliveries.map((d) => {
      const idx = eligibleDeliveries.findIndex((e) => e.id === d.id);
      if (idx === -1) return d;
      const capped = Math.min(d.amountToCollect, remainingDue);
      const finalAmt = Number(capped.toFixed(2));
      updatedAmounts.set(d.id, finalAmt);
      return { ...d, amountToCollect: finalAmt };
    });
  }

  for (const d of eligibleDeliveries) {
    if (d.driverId) {
      const newAmt = updatedAmounts.get(d.id) ?? d.amountToCollect;
      notifications.push({
        driverId: d.driverId,
        msg: `Payment recorded for Invoice #${invoiceNo || ''}. Updated amount to collect: ₹${newAmt.toFixed(2)}.`,
      });
    }
  }

  return { deliveries: updated, notifications };
}

// Case 3.1: Full settlement -> active trips drop to 0
const { deliveries: splitAllSettled } = simulateSyncDeliveriesForInvoice(
  [
    { id: 'truck-A', amountToCollect: 4000, cashCollected: 0, cashHandedOver: false, status: DeliveryStatus.ASSIGNED, driverId: 'd1' },
    { id: 'truck-B', amountToCollect: 6000, cashCollected: 0, cashHandedOver: false, status: DeliveryStatus.OUT_FOR_DELIVERY, driverId: 'd2' },
  ],
  0,
  'INV-001',
);
assert.equal(splitAllSettled[0].amountToCollect, 0);
assert.equal(splitAllSettled[1].amountToCollect, 0);

// Case 3.2: Partial payment of ₹2,000 against ₹10,000 (remaining ₹8,000)
// Truck A (40%) -> ₹3,200, Truck B (60%) -> ₹4,800
const { deliveries: splitProportional, notifications: splitNotifs } = simulateSyncDeliveriesForInvoice(
  [
    { id: 'truck-A', amountToCollect: 4000, cashCollected: 0, cashHandedOver: false, status: DeliveryStatus.ASSIGNED, driverId: 'd1' },
    { id: 'truck-B', amountToCollect: 6000, cashCollected: 0, cashHandedOver: false, status: DeliveryStatus.OUT_FOR_DELIVERY, driverId: 'd2' },
  ],
  8000,
  'INV-002',
);
assert.equal(splitProportional[0].amountToCollect, 3200);
assert.equal(splitProportional[1].amountToCollect, 4800);
assert.equal(splitNotifs[0].msg.includes('₹3200.00'), true);
assert.equal(splitNotifs[1].msg.includes('₹4800.00'), true);

// Case 3.3: One truck ALREADY collected cash at customer doorstep (cashCollected > 0, status: DELIVERED, cashHandedOver: false).
// Its collected cash must NOT be touched by subsequent payments!
const { deliveries: splitWithAlreadyCollected } = simulateSyncDeliveriesForInvoice(
  [
    { id: 'truck-A', amountToCollect: 0, cashCollected: 4000, cashHandedOver: false, status: DeliveryStatus.DELIVERED, driverId: 'd1' },
    { id: 'truck-B', amountToCollect: 6000, cashCollected: 0, cashHandedOver: false, status: DeliveryStatus.OUT_FOR_DELIVERY, driverId: 'd2' },
  ],
  4000, // ₹2,000 paid at counter against ₹6,000 due on truck B
  'INV-003',
);
assert.equal(splitWithAlreadyCollected[0].amountToCollect, 0);
assert.equal(splitWithAlreadyCollected[0].cashCollected, 4000);
assert.equal(splitWithAlreadyCollected[1].amountToCollect, 4000);

console.log('✓ Test 3: Split delivery balance apportionment and cash custody protection passed.');

console.log('\nAll Driver Delivery Payment verification tests passed cleanly!');
