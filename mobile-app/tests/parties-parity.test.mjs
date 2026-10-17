import test from 'node:test';
import assert from 'node:assert/strict';

// Helper function definitions matching web dashboard and mobile app exactly:

function getPartyTotalDue(party) {
  return (party.creditLedgers || [])
    .filter((c) => c.status !== 'SETTLED')
    .reduce((sum, c) => {
      const amt = Number(c.amountDue || 0);
      return c.type === 'RECEIVABLE' ? sum + amt : sum - amt;
    }, 0);
}

function getPartyPayable(party) {
  return (party.creditLedgers || [])
    .filter((c) => c.status !== 'SETTLED' && c.type === 'PAYABLE')
    .reduce((sum, c) => sum + Number(c.amountDue || 0), 0);
}

function computeAgeing(parties, nowTime) {
  let totalReceivables = 0;
  let b0to15 = 0;
  let b15to30 = 0;
  let b30to60 = 0;
  let b60plus = 0;

  for (const p of parties) {
    for (const cl of p.creditLedgers || []) {
      if (cl.status !== 'SETTLED' && cl.type === 'RECEIVABLE') {
        const amt = Number(cl.amountDue || 0);
        totalReceivables += amt;
        const dueTime = cl.dueDate ? new Date(cl.dueDate).getTime() : nowTime;
        const daysOverdue = Math.max(0, Math.floor((nowTime - dueTime) / (1000 * 60 * 60 * 24)));
        if (daysOverdue <= 15) b0to15 += amt;
        else if (daysOverdue <= 30) b15to30 += amt;
        else if (daysOverdue <= 60) b30to60 += amt;
        else b60plus += amt;
      }
    }
  }
  return { totalReceivables, b0to15, b15to30, b30to60, b60plus };
}

function canDeleteParty(party) {
  const receivableDue = (party.creditLedgers || [])
    .filter((cl) => cl.status !== 'SETTLED' && cl.type === 'RECEIVABLE')
    .reduce((sum, cl) => sum + Number(cl.amountDue || 0), 0);
  const payableDue = (party.creditLedgers || [])
    .filter((cl) => cl.status !== 'SETTLED' && cl.type === 'PAYABLE')
    .reduce((sum, cl) => sum + Number(cl.amountDue || 0), 0);
  return !(receivableDue > 0.01 || payableDue > 0.01);
}

function filterParties(parties, search, regFilter, dueFilter) {
  const q = search.trim().toLowerCase();
  const cleanQPhone = q.replace(/\D/g, '');

  return parties.filter((p) => {
    // 1. Search Query
    if (q) {
      const name = (p.name || '').toLowerCase();
      const phone = p.phone || '';
      const gstin = (p.gstin || '').toLowerCase();
      const address = (p.address || '').toLowerCase();

      const phoneDigits = phone.replace(/\D/g, '');
      const matchesPhone =
        phone.includes(q) ||
        (cleanQPhone.length >= 3 && (
          phoneDigits.includes(cleanQPhone) ||
          cleanQPhone.includes(phoneDigits) ||
          (cleanQPhone.length >= 10 && phoneDigits.includes(cleanQPhone.slice(-10)))
        ));

      const matchesSearch =
        name.includes(q) ||
        matchesPhone ||
        gstin.includes(q) ||
        address.includes(q);
      if (!matchesSearch) return false;
    }

    // 2. Registration Status Filter
    if (regFilter === 'REGISTERED' && p.isSaved === false) return false;
    if (regFilter === 'UNREGISTERED' && p.isSaved !== false) return false;

    // 3. Balance Due Filter
    const totalDue = getPartyTotalDue(p);
    const payable = getPartyPayable(p);
    if (dueFilter === 'DUES' && totalDue <= 0.01) return false;
    if (dueFilter === 'PAYABLES' && !(totalDue < -0.01 || payable > 0.01)) return false;
    if (dueFilter === 'CLEARED' && !(Math.abs(totalDue) <= 0.01 && payable <= 0.01)) return false;

    return true;
  });
}

function getWhatsAppUrl(phone, text) {
  const msg = text ? encodeURIComponent(text) : '';
  if (!phone) {
    return msg ? `https://wa.me/?text=${msg}` : 'https://wa.me/';
  }

  const digits = phone.replace(/\D/g, '');
  if (!digits || digits.length < 10) {
    return msg ? `https://wa.me/?text=${msg}` : 'https://wa.me/';
  }

  if (digits.length === 10) {
    return `https://wa.me/91${digits}${msg ? `?text=${msg}` : ''}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `https://wa.me/${digits}${msg ? `?text=${msg}` : ''}`;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `https://wa.me/91${digits.slice(1)}${msg ? `?text=${msg}` : ''}`;
  }

  return `https://wa.me/${digits}${msg ? `?text=${msg}` : ''}`;
}

function isLedgerOverdue(cl, now) {
  const isClPayable = cl.type === 'PAYABLE';
  return (
    !isClPayable &&
    Boolean(cl.dueDate) &&
    cl.status !== 'SETTLED' &&
    now > 0 &&
    new Date(cl.dueDate).getTime() < now
  );
}

function validateGstin(gstin) {
  const clean = gstin.trim().toUpperCase();
  if (!clean) return { valid: true };
  if (clean.length !== 15) return { valid: false, reason: 'Length must be strictly 15 characters' };
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{2}$/;
  if (!gstinRegex.test(clean)) return { valid: false, reason: 'Invalid format' };
  return { valid: true, value: clean };
}

// ==========================================
// TEST SUITE
// ==========================================

test('1. Financial calculation logic parity: receivables, store credits/payables & net balance', () => {
  const customerWithDue = {
    id: 'p1',
    name: 'Ramesh Tiles',
    creditLedgers: [
      { id: 'c1', amountDue: 15000, type: 'RECEIVABLE', status: 'UNPAID' },
      { id: 'c2', amountDue: 5000, type: 'RECEIVABLE', status: 'SETTLED' }, // settled ignored
    ],
  };
  assert.equal(getPartyTotalDue(customerWithDue), 15000);
  assert.equal(getPartyPayable(customerWithDue), 0);

  const customerWithStoreCredit = {
    id: 'p2',
    name: 'Balaji Builders',
    creditLedgers: [
      { id: 'c3', amountDue: 3500, type: 'PAYABLE', status: 'UNPAID' },
    ],
  };
  assert.equal(getPartyTotalDue(customerWithStoreCredit), -3500);
  assert.equal(getPartyPayable(customerWithStoreCredit), 3500);

  const customerOffset = {
    id: 'p3',
    name: 'Krishna Interiors',
    creditLedgers: [
      { id: 'c4', amountDue: 10000, type: 'RECEIVABLE', status: 'UNPAID' },
      { id: 'c5', amountDue: 3000, type: 'PAYABLE', status: 'UNPAID' },
    ],
  };
  assert.equal(getPartyTotalDue(customerOffset), 7000); // 10000 - 3000
  assert.equal(getPartyPayable(customerOffset), 3000);

  const clearedCustomer = {
    id: 'p4',
    name: 'Suresh Kumar',
    creditLedgers: [
      { id: 'c6', amountDue: 8000, type: 'RECEIVABLE', status: 'SETTLED' },
      { id: 'c7', amountDue: 0, type: 'RECEIVABLE', status: 'UNPAID' },
    ],
  };
  assert.equal(getPartyTotalDue(clearedCustomer), 0);
  assert.equal(getPartyPayable(clearedCustomer), 0);
});

test('2. 5-bucket Credit Ageing calculation (0-15, 15-30, 30-60, 60+ days, and total)', () => {
  const now = new Date('2026-10-17T12:00:00Z').getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const mockParties = [
    {
      id: 'p1',
      creditLedgers: [
        {
          id: 'c1',
          amountDue: 1000,
          type: 'RECEIVABLE',
          status: 'UNPAID',
          dueDate: new Date(now - 5 * dayMs).toISOString(), // 5 days overdue -> 0-15
        },
        {
          id: 'c2',
          amountDue: 2000,
          type: 'RECEIVABLE',
          status: 'UNPAID',
          dueDate: new Date(now - 20 * dayMs).toISOString(), // 20 days overdue -> 15-30
        },
        {
          id: 'c3',
          amountDue: 3000,
          type: 'RECEIVABLE',
          status: 'UNPAID',
          dueDate: new Date(now - 45 * dayMs).toISOString(), // 45 days overdue -> 30-60
        },
        {
          id: 'c4',
          amountDue: 4000,
          type: 'RECEIVABLE',
          status: 'UNPAID',
          dueDate: new Date(now - 90 * dayMs).toISOString(), // 90 days overdue -> 60+
        },
        {
          id: 'c5',
          amountDue: 5000,
          type: 'RECEIVABLE',
          status: 'SETTLED', // SETTLED -> excluded
          dueDate: new Date(now - 100 * dayMs).toISOString(),
        },
        {
          id: 'c6',
          amountDue: 6000,
          type: 'PAYABLE', // PAYABLE -> excluded from receivables ageing
          status: 'UNPAID',
          dueDate: new Date(now - 5 * dayMs).toISOString(),
        },
      ],
    },
  ];

  const ageing = computeAgeing(mockParties, now);
  assert.equal(ageing.b0to15, 1000);
  assert.equal(ageing.b15to30, 2000);
  assert.equal(ageing.b30to60, 3000);
  assert.equal(ageing.b60plus, 4000);
  assert.equal(ageing.totalReceivables, 10000);
});

test('3. Filtering & Search parity: All vs Dues vs Payables vs Cleared; Saved vs Walk-ins; name/phone/gstin/address', () => {
  const parties = [
    {
      id: 'p1',
      name: 'Ramesh Marble',
      phone: '9876543210',
      address: 'Plot 4, Mansarovar',
      gstin: '08AAAAA0000A1Z5',
      isSaved: true,
      creditLedgers: [{ amountDue: 5000, type: 'RECEIVABLE', status: 'UNPAID' }],
    },
    {
      id: 'p2',
      name: 'Walk-in Client',
      phone: '9123456789',
      address: 'Jaipur',
      isSaved: false,
      creditLedgers: [{ amountDue: 1200, type: 'PAYABLE', status: 'UNPAID' }],
    },
    {
      id: 'p3',
      name: 'Suresh Architect',
      phone: '9829012345',
      address: 'Malviya Nagar',
      gstin: '08BBBBB1111B1Z2',
      isSaved: true,
      creditLedgers: [],
    },
  ];

  // Search by name
  assert.equal(filterParties(parties, 'Ramesh', 'ALL', 'ALL').length, 1);
  // Search by phone
  assert.equal(filterParties(parties, '9123456789', 'ALL', 'ALL').length, 1);
  // Search by gstin
  assert.equal(filterParties(parties, '08BBBBB', 'ALL', 'ALL').length, 1);
  // Search by address
  assert.equal(filterParties(parties, 'Mansarovar', 'ALL', 'ALL').length, 1);

  // Registration Filter
  assert.equal(filterParties(parties, '', 'REGISTERED', 'ALL').length, 2);
  assert.equal(filterParties(parties, '', 'UNREGISTERED', 'ALL').length, 1);

  // Balance Filter
  assert.equal(filterParties(parties, '', 'ALL', 'DUES').length, 1);
  assert.equal(filterParties(parties, '', 'ALL', 'PAYABLES').length, 1);
  assert.equal(filterParties(parties, '', 'ALL', 'CLEARED').length, 1);
});

test('4. Delete Customer safety check: zero-due policy enforcement', () => {
  const partyWithReceivable = {
    id: 'p1',
    creditLedgers: [{ amountDue: 100, type: 'RECEIVABLE', status: 'UNPAID' }],
  };
  assert.equal(canDeleteParty(partyWithReceivable), false, 'Cannot delete party with unpaid receivables');

  const partyWithPayable = {
    id: 'p2',
    creditLedgers: [{ amountDue: 250, type: 'PAYABLE', status: 'UNPAID' }],
  };
  assert.equal(canDeleteParty(partyWithPayable), false, 'Cannot delete party with store payables');

  const zeroDueParty = {
    id: 'p3',
    creditLedgers: [{ amountDue: 500, type: 'RECEIVABLE', status: 'SETTLED' }],
  };
  assert.equal(canDeleteParty(zeroDueParty), true, 'Can delete zero due party');
});

test('5. GSTIN validation logic', () => {
  assert.equal(validateGstin('').valid, true, 'Empty GSTIN is optional and valid');
  assert.equal(validateGstin('   ').valid, true, 'Whitespace-only GSTIN is optional and valid');
  assert.equal(validateGstin('12345').valid, false, 'Short GSTIN rejected');
  assert.equal(validateGstin('07AAAAA0000A1Z5').valid, true, 'Standard 15-char GSTIN accepted');
  assert.equal(validateGstin('08BCCCC9999C2Z8').valid, true, 'Valid Rajasthan GSTIN accepted');
});

test('6. WhatsApp URL generation for all phone variations (10-digit, 91-prefixed, 0-prefixed, international)', () => {
  const text = 'Hello Test';
  const encoded = encodeURIComponent(text);

  // 10-digit Indian number: prefixes 91
  assert.equal(getWhatsAppUrl('9876543210', text), `https://wa.me/919876543210?text=${encoded}`);
  assert.equal(getWhatsAppUrl(' 98765-43210 ', text), `https://wa.me/919876543210?text=${encoded}`);

  // 12-digit Indian number with +91 or 91
  assert.equal(getWhatsAppUrl('+91 9876543210', text), `https://wa.me/919876543210?text=${encoded}`);
  assert.equal(getWhatsAppUrl('919876543210', text), `https://wa.me/919876543210?text=${encoded}`);

  // 11-digit Indian number with leading 0
  assert.equal(getWhatsAppUrl('09876543210', text), `https://wa.me/919876543210?text=${encoded}`);

  // International phone number
  assert.equal(getWhatsAppUrl('+1 415 555 2671', text), `https://wa.me/14155552671?text=${encoded}`);

  // Invalid or short phone
  assert.equal(getWhatsAppUrl('1234', text), `https://wa.me/?text=${encoded}`);
  assert.equal(getWhatsAppUrl('', text), `https://wa.me/?text=${encoded}`);
  assert.equal(getWhatsAppUrl(null, text), `https://wa.me/?text=${encoded}`);
});

test('7. Phone search matching with formatted queries (spaces, dashes, country codes)', () => {
  const parties = [
    { id: 'p1', name: 'Ramesh Tiles', phone: '9876543210', isSaved: true },
    { id: 'p2', name: 'Balaji Granite', phone: '9123456789', isSaved: true },
  ];

  // User searches with space or dash in phone
  assert.equal(filterParties(parties, '98765 43210', 'ALL', 'ALL').length, 1);
  assert.equal(filterParties(parties, '98765-43210', 'ALL', 'ALL').length, 1);
  assert.equal(filterParties(parties, '+91 98765 43210', 'ALL', 'ALL').length, 1);
  assert.equal(filterParties(parties, '56789', 'ALL', 'ALL').length, 1);
});

test('8. Overdue badge logic: store payables owed to customer must NEVER be overdue', () => {
  const now = new Date('2026-10-17T12:00:00Z').getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const pastDate = new Date(now - 10 * dayMs).toISOString();

  // Past-due RECEIVABLE -> overdue
  const receivable = {
    amountDue: 5000,
    type: 'RECEIVABLE',
    status: 'UNPAID',
    dueDate: pastDate,
  };
  assert.equal(isLedgerOverdue(receivable, now), true, 'Receivable past due date is overdue');

  // Past-due PAYABLE -> NOT overdue (store owes customer)
  const payable = {
    amountDue: 2000,
    type: 'PAYABLE',
    status: 'UNPAID',
    dueDate: pastDate,
  };
  assert.equal(isLedgerOverdue(payable, now), false, 'Store payable must never be marked overdue');

  // Settled receivable -> NOT overdue
  const settled = {
    amountDue: 0,
    type: 'RECEIVABLE',
    status: 'SETTLED',
    dueDate: pastDate,
  };
  assert.equal(isLedgerOverdue(settled, now), false, 'Settled ledger must never be overdue');
});
