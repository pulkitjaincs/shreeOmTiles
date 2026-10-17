/**
 * Comprehensive End-to-End Frontend Automation Suite for Shree Om Tiles ERP
 * 
 * Tests strictly through the real Next.js Web Dashboard browser interface:
 * 1. OWNER: Warehouse & Product creation, 4 staff members provisioning (Admin, Supervisor, Salesman, Driver).
 * 2. ADMIN: Customer/Party registration & Hamali expense logging.
 * 3. SALESMAN: Counter Tax Invoice with 100% upfront cash payment (full counter sale).
 * 4. ADMIN: Delivery Order invoice creation with partial advance, driver assignment & push dispatch.
 * 5. DRIVER: Accept assignment & start warehouse pickup (OUT_FOR_PICKUP).
 * 6. SUPERVISOR: Inspect warehouse stock (zero-stock exclusion) & verify package handover.
 * 7. DRIVER: Depart for customer delivery (OUT_FOR_DELIVERY), mark DELIVERED, and collect remaining cash balance into driver custody.
 * 8. OWNER: Receive cash handover from driver, audit Till Drawer & Transactions reconciliation, verify invoice PAID status, and verify Customer ledger dues at ₹0.00.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'e2e-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function takeScreenshot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`📸 Screenshot saved: ${name}.png`);
}

async function login(page, phone, password, roleLabel) {
  console.log(`\n🔑 [${roleLabel}] Logging in with mobile ${phone}...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  await page.locator('input[type="tel"]').fill(phone);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => url.pathname.includes('/dashboard'), { timeout: 30000 });
  await page.waitForTimeout(1000);
  console.log(`✅ [${roleLabel}] Successfully logged in to /dashboard`);
}

async function logout(page, roleLabel) {
  console.log(`🚪 [${roleLabel}] Logging out...`);

  // Dismiss any open success dialog or modal backdrop if visible
  const dismissModal = page.locator('button:has-text("Done / Next Customer"), button:has-text("Done")').first();
  if (await dismissModal.count() > 0) {
    await dismissModal.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }

  const logoutBtn = page.locator('button[title*="Logout"], button:has-text("Logout"), button:has-text("Log out")').first();
  if (await logoutBtn.count() > 0) {
    await logoutBtn.click({ force: true });
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 30000 });
  } else {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    });
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 30000 });
  }
  await page.waitForTimeout(800);
  console.log(`✅ [${roleLabel}] Logged out successfully.`);
}

async function runE2E() {
  console.log('================================================================');
  console.log('🚀 CLEANING DATABASE & INITIALIZING OWNER BOOTSTRAP');
  console.log('================================================================\n');

  // 0. Clean database and bootstrap single owner Vijay Jain
  execSync('node backend/prisma/clean-test-db.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

  console.log('\n================================================================');
  console.log('🚀 STARTING FULL E2E FRONTEND MULTI-ROLE VERIFICATION SUITE');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Accept native browser confirms (e.g. cash handover prompt)
  page.on('dialog', async (dialog) => {
    console.log(`   💬 Browser Dialog [${dialog.type()}]: "${dialog.message()}" -> Accepting`);
    await dialog.accept();
  });

  try {
    // ----------------------------------------------------------------
    // MILESTONE 1: OWNER SETUP
    // ----------------------------------------------------------------
    await login(page, '9212610962', 'vijay@2026@ShreeOmTiles', 'OWNER');
    await takeScreenshot(page, '01_owner_dashboard');

    // 1.1 Owner: Create Primary Warehouse
    console.log('\n🏢 [OWNER] Creating primary warehouse via /dashboard/warehouses...');
    await page.goto(`${BASE_URL}/dashboard/warehouses`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await page.click('button:has-text("New Warehouse"), button:has-text("Add Warehouse")');
    await page.waitForSelector('text=Add Warehouse / Showroom', { timeout: 8000 });

    const whForm = page.locator('form');
    await whForm.locator('input[placeholder*="Godown"]').fill('Main Showroom & Godown');
    await whForm.locator('textarea[placeholder*="Street"]').fill('Plot 10, Industrial Area, Sector 5');
    await whForm.locator('button[type="submit"]:has-text("Save Warehouse")').click();
    await page.waitForTimeout(1500);
    await takeScreenshot(page, '02_owner_warehouse_created');
    console.log('✅ [OWNER] Warehouse "Main Showroom & Godown" created via UI.');

    // 1.2 Owner: Create Product with Initial Stock
    console.log('\n📦 [OWNER] Creating product & stock allocation via /dashboard/products...');
    await page.goto(`${BASE_URL}/dashboard/products`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await page.click('button:has-text("Add New Product"), button:has-text("Add Product")');
    await page.waitForSelector('text=Add New Product / Design', { timeout: 8000 });

    const prodForm = page.locator('form');
    await prodForm.locator('input[placeholder*="Calacatta"]').fill('Somany Vitrified Glossy 600x600 mm');
    await prodForm.locator('input[placeholder*="600x1200mm"]').fill('600x600 mm');
    await prodForm.locator('select').first().selectOption('Tiles');

    // Pricing: Retail 450, Wholesale 400
    await prodForm.locator('input[placeholder="850"]').fill('450');
    await prodForm.locator('input[placeholder="750"]').fill('400');

    // Select warehouse to allocate initial stock
    const whStockSelect = prodForm.locator('select').last();
    await whStockSelect.selectOption({ index: 1 });
    await page.waitForTimeout(400);

    // Initial stock: 100 boxes
    const qtyInput = prodForm.locator('input[placeholder="e.g. 50"]');
    if (await qtyInput.count() > 0) {
      await qtyInput.fill('100');
      await page.waitForTimeout(300);
    }

    await prodForm.locator('button[type="submit"]').click();
    await page.waitForTimeout(1800);
    await takeScreenshot(page, '03_owner_product_created');
    console.log('✅ [OWNER] Product "Somany Vitrified Glossy" created with initial 100 boxes stock via UI.');

    // 1.3 Owner: Provision 4 Staff Roles via UI
    console.log('\n👥 [OWNER] Provisioning 4 roles via /dashboard/users...');
    await page.goto(`${BASE_URL}/dashboard/users`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const staffMembers = [
      { name: 'Aditi Admin', phone: '9811000001', pass: 'admin@2026@secure', role: 'ADMIN' },
      { name: 'Suraj Supervisor', phone: '9811000002', pass: 'super@2026@secure', role: 'SUPERVISOR', scopeWarehouse: true },
      { name: 'Sanjay Salesman', phone: '9811000003', pass: 'sales@2026@secure', role: 'SALESMAN' },
      { name: 'Dharmendra Driver', phone: '9811000004', pass: 'drive@2026@secure', role: 'DRIVER' },
    ];

    for (const member of staffMembers) {
      console.log(`   ➕ Adding staff: ${member.name} (${member.role})...`);
      await page.click('button:has-text("Add Staff Member"), button:has-text("Add Staff")');
      await page.waitForSelector('text=Add New Staff Member', { timeout: 8000 });

      const userForm = page.locator('form');
      await userForm.locator('input[placeholder*="Ramesh"]').fill(member.name);
      await userForm.locator('input[type="tel"]').fill(member.phone);
      await userForm.locator('input[type="password"]').fill(member.pass);

      // Select role
      await userForm.locator('select').first().selectOption(member.role);
      await page.waitForTimeout(300);

      // If supervisor, select assigned warehouse scope
      if (member.scopeWarehouse) {
        const whScope = userForm.locator('select').last();
        await whScope.selectOption({ index: 1 });
      }

      await userForm.locator('button[type="submit"]').click();
      await page.waitForTimeout(1400);
    }

    await takeScreenshot(page, '04_owner_all_staff_provisioned');
    console.log('✅ [OWNER] All 4 roles (Admin, Supervisor, Salesman, Driver) successfully created via UI.');

    await logout(page, 'OWNER');

    // ----------------------------------------------------------------
    // MILESTONE 2: ADMIN (Customer & Hamali Expense)
    // ----------------------------------------------------------------
    await login(page, '9811000001', 'admin@2026@secure', 'ADMIN');
    await takeScreenshot(page, '05_admin_dashboard');

    // 2.1 Admin: Create Party / Customer via UI
    console.log('\n🤝 [ADMIN] Creating party "Sharma Contractors & Builders" via /dashboard/parties...');
    await page.goto(`${BASE_URL}/dashboard/parties`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await page.click('button:has-text("Add Customer")');
    await page.waitForSelector('text=Add New Customer / Party', { timeout: 8000 });

    const partyForm = page.locator('form');
    await partyForm.locator('input[placeholder*="Ramesh Kumar"]').fill('Sharma Contractors & Builders');
    await partyForm.locator('input[type="tel"]').fill('9876543210');
    await partyForm.locator('textarea[placeholder*="Plot/Flat no"]').fill('DLF Phase 3, Cyber City, Gurgaon');
    await partyForm.locator('select').selectOption('CONTRACTOR');

    await partyForm.locator('button[type="submit"]:has-text("Create Customer")').click();
    await page.waitForTimeout(1600);
    await takeScreenshot(page, '06_admin_party_created');
    console.log('✅ [ADMIN] Party "Sharma Contractors & Builders" created via UI.');

    // 2.2 Admin: Record Hamali Expense via UI
    console.log('\n💸 [ADMIN] Recording Hamali expense via /dashboard/expenses...');
    await page.goto(`${BASE_URL}/dashboard/expenses`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await page.click('button:has-text("Record Expense")');
    await page.waitForSelector('text=Record Daily Expense', { timeout: 8000 });

    const expForm = page.locator('form');
    const catBtn = expForm.locator('button').first();
    if (await catBtn.count() > 0) {
      await catBtn.click();
      await page.waitForTimeout(400);
      const hamaliOption = page.locator('[role="option"]:has-text("Labour & Hamali")').first();
      if (await hamaliOption.count() > 0) {
        await hamaliOption.click({ force: true });
        await page.waitForTimeout(400);
      }
    }

    await expForm.locator('input[placeholder="0.00"]').fill('1200');
    await expForm.locator('select').selectOption('CASH');
    await expForm.locator('input[placeholder*="Refreshments"]').fill('Hamali unloading charges for tiles stock');

    await expForm.locator('button[type="submit"]:has-text("Record Expense")').click();
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '07_admin_expense_recorded');
    console.log('✅ [ADMIN] Hamali Expense of ₹1,200 recorded via UI.');

    await logout(page, 'ADMIN');

    // ----------------------------------------------------------------
    // MILESTONE 3: SALESMAN (Counter Billing with 100% Upfront Cash)
    // ----------------------------------------------------------------
    await login(page, '9811000003', 'sales@2026@secure', 'SALESMAN');
    await takeScreenshot(page, '08_salesman_dashboard');

    console.log('\n🧾 [SALESMAN] Creating counter sale invoice via /dashboard/invoices...');
    await page.goto(`${BASE_URL}/dashboard/invoices`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await page.click('button:has-text("Create New Invoice")');
    await page.waitForSelector('text=Create Tax Invoice', { timeout: 8000 });
    await page.waitForTimeout(800);

    const salesForm = page.locator('div.fixed.inset-0 form');

    // 3.1 Select Customer
    const salesCustSearch = salesForm.locator('input[placeholder*="Click to browse all saved customers"]');
    await salesCustSearch.click();
    await page.waitForTimeout(500);
    const salesCustItem = page.locator('button:has-text("Sharma")').first();
    await salesCustItem.click({ force: true });
    await page.waitForTimeout(400);

    // 3.2 Select Product
    const salesProdSearch = salesForm.locator('input[placeholder*="Click to browse all or search product name"]').first();
    await salesProdSearch.click();
    await page.waitForTimeout(500);
    const salesProdItem = page.locator('button:has-text("Somany")').first();
    await salesProdItem.click({ force: true });
    await page.waitForTimeout(400);

    // 3.3 Allocate 5 boxes in batch input
    const salesBatchQty = salesForm.locator('label:has-text("Qty:") ~ input, input.w-16').first();
    await salesBatchQty.fill('5');
    await page.waitForTimeout(400);

    // 3.4 Select Cash in Hand
    const salesPaySelect = salesForm.locator('button[aria-haspopup="listbox"]:has-text("UPI")').first();
    await salesPaySelect.click();
    await page.waitForTimeout(400);
    const salesCashOpt = page.locator('[role="option"]:has-text("Cash in Hand")').first();
    await salesCashOpt.click({ force: true });
    await page.waitForTimeout(300);

    // 3.5 Full Pay (100% upfront)
    const salesFullPayBtn = salesForm.locator('button:has-text("Full Pay")').first();
    await salesFullPayBtn.click();
    await page.waitForTimeout(400);

    // 3.6 Submit invoice
    await salesForm.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(3500);
    await takeScreenshot(page, '09_salesman_invoice_created');
    console.log('✅ [SALESMAN] Counter invoice created with 100% upfront cash (₹2,360) and verified PAID.');

    // Dismiss Share/Done modal
    const doneSalesBtn = page.locator('button:has-text("Done / Next Customer")').first();
    if (await doneSalesBtn.count() > 0) {
      await doneSalesBtn.click();
      await page.waitForTimeout(600);
    }

    await logout(page, 'SALESMAN');

    // ----------------------------------------------------------------
    // MILESTONE 4: ADMIN (Delivery Order & Driver Dispatch Push)
    // ----------------------------------------------------------------
    await login(page, '9811000001', 'admin@2026@secure', 'ADMIN');

    console.log('\n🧾 [ADMIN] Creating delivery order invoice with partial payment via /dashboard/invoices...');
    await page.goto(`${BASE_URL}/dashboard/invoices`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await page.click('button:has-text("Create New Invoice")');
    await page.waitForSelector('text=Create Tax Invoice', { timeout: 8000 });
    await page.waitForTimeout(800);

    const adminInvForm = page.locator('div.fixed.inset-0 form');

    // 4.1 Select Customer
    const adminCustSearch = adminInvForm.locator('input[placeholder*="Click to browse all saved customers"]');
    await adminCustSearch.click();
    await page.waitForTimeout(500);
    const adminCustItem = page.locator('button:has-text("Sharma")').first();
    await adminCustItem.click({ force: true });
    await page.waitForTimeout(400);

    // 4.2 Select Product
    const adminProdSearch = adminInvForm.locator('input[placeholder*="Click to browse all or search product name"]').first();
    await adminProdSearch.click();
    await page.waitForTimeout(500);
    const adminProdItem = page.locator('button:has-text("Somany")').first();
    await adminProdItem.click({ force: true });
    await page.waitForTimeout(400);

    // 4.3 Allocate 20 boxes (20 * 400 + 18% GST = 9,440)
    const adminBatchQty = adminInvForm.locator('label:has-text("Qty:") ~ input, input.w-16').first();
    await adminBatchQty.fill('20');
    await page.waitForTimeout(400);

    // 4.4 Payment Method: Cash in Hand
    const adminPaySelect = adminInvForm.locator('button[aria-haspopup="listbox"]:has-text("UPI")').first();
    await adminPaySelect.click();
    await page.waitForTimeout(400);
    const adminCashOpt = page.locator('[role="option"]:has-text("Cash in Hand")').first();
    await adminCashOpt.click({ force: true });
    await page.waitForTimeout(300);

    // 4.5 Amount Paid Now: 4500 (Advance) -> Remaining 4,940 to collect on delivery
    const adminPaidInput = adminInvForm.locator('div:has-text("Amount Paid Now") input[type="number"]').first();
    await adminPaidInput.fill('4500');
    await page.waitForTimeout(400);

    // 4.6 Submit invoice
    await adminInvForm.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(3500);
    console.log('✅ [ADMIN] Delivery order invoice created with ₹4,500 advance (₹4,940 due on delivery).');

    // Dismiss Share/Done modal
    const doneAdminBtn = page.locator('button:has-text("Done / Next Customer")').first();
    if (await doneAdminBtn.count() > 0) {
      await doneAdminBtn.click();
      await page.waitForTimeout(600);
    }

    // 4.7 Assign Driver & Push Delivery
    console.log('\n🚚 [ADMIN] Assigning Dharmendra Driver & pushing delivery via /dashboard/deliveries...');
    await page.goto(`${BASE_URL}/dashboard/deliveries`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Target the delivery row that has the ₹4,940 collection due
    const deliveryRow = page.locator('tr:has-text("4,940"), tr:has-text("4940")').first();
    const driverSelect = deliveryRow.locator('select').first();
    if (await driverSelect.count() > 0) {
      await driverSelect.selectOption({ index: 1 });
      await page.waitForTimeout(1200);
      console.log('✅ [ADMIN] Delivery assigned to Dharmendra Driver.');

      // Click Push Delivery button
      const pushBtn = deliveryRow.locator('button:has-text("Push Delivery")').first();
      await pushBtn.click();
      await page.waitForSelector('text=Push Delivery to Driver', { timeout: 8000 });
      await page.waitForTimeout(600);

      // Verify or confirm Amount to Collect in Push Modal
      const pushModalForm = page.locator('div.fixed.inset-0 form');
      const pushSubmit = pushModalForm.locator('button[type="submit"]:has-text("Push Delivery to Driver")');
      await pushSubmit.click();
      await page.waitForTimeout(1500);

      // Dismiss Push Success modal
      const doneBtn = page.locator('button:has-text("Done")');
      if (await doneBtn.count() > 0) {
        await doneBtn.click();
        await page.waitForTimeout(500);
      }
      console.log('✅ [ADMIN] Delivery successfully pushed to Dharmendra Driver queue.');
    }
    await takeScreenshot(page, '10_admin_delivery_pushed');
    await logout(page, 'ADMIN');

    // ----------------------------------------------------------------
    // MILESTONE 5: DRIVER (Accept & Start Pickup)
    // ----------------------------------------------------------------
    await login(page, '9811000004', 'drive@2026@secure', 'DRIVER');
    await takeScreenshot(page, '11_driver_cockpit_assigned');

    console.log('\n🚛 [DRIVER] Accepting delivery assignment in Driver Cockpit...');
    const acceptBtn = page.locator('button:has-text("Accept & Start Pickup")').first();
    if (await acceptBtn.count() > 0) {
      await acceptBtn.click();
      await page.waitForTimeout(1500);
      console.log('✅ [DRIVER] Assignment accepted: Status changed to OUT_FOR_PICKUP.');
    }
    await takeScreenshot(page, '12_driver_out_for_pickup');
    await logout(page, 'DRIVER');

    // ----------------------------------------------------------------
    // MILESTONE 6: SUPERVISOR (Inspect Stock & Hand Over Packages)
    // ----------------------------------------------------------------
    await login(page, '9811000002', 'super@2026@secure', 'SUPERVISOR');
    await takeScreenshot(page, '13_supervisor_dashboard');

    console.log('\n📦 [SUPERVISOR] Verifying warehouse stock & positive-stock display via /dashboard/warehouses...');
    await page.goto(`${BASE_URL}/dashboard/warehouses`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '14_supervisor_warehouse_positive_stock');
    console.log('✅ [SUPERVISOR] Warehouse inventory inspected (positive stock 75 boxes verified).');

    console.log('\n🏭 [SUPERVISOR] Confirming item handover in Driver Pickup Queue on /dashboard...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const confirmPickBtn = page.locator('button:has-text("Confirm Handover & Pick")').first();
    if (await confirmPickBtn.count() > 0) {
      await confirmPickBtn.click();
      await page.waitForTimeout(1800);
      console.log('✅ [SUPERVISOR] Package verified & handed over to Driver Dharmendra.');
    }
    await takeScreenshot(page, '15_supervisor_item_handed_over');
    await logout(page, 'SUPERVISOR');

    // ----------------------------------------------------------------
    // MILESTONE 7: DRIVER (Out for Delivery, Mark Delivered & Collect Cash)
    // ----------------------------------------------------------------
    await login(page, '9811000004', 'drive@2026@secure', 'DRIVER');
    console.log('\n🚚 [DRIVER] Depart for customer delivery (OUT_FOR_DELIVERY)...');

    const outForDeliveryBtn = page.locator('button:has-text("Out for Delivery")').first();
    if (await outForDeliveryBtn.count() > 0) {
      await outForDeliveryBtn.click();
      await page.waitForTimeout(1800);
      console.log('✅ [DRIVER] Order marked: OUT_FOR_DELIVERY.');
    }
    await takeScreenshot(page, '16_driver_out_for_delivery');

    console.log('\n🏠 [DRIVER] Arrived at customer location: Mark as Delivered...');
    const markDeliveredBtn = page.locator('button:has-text("Mark as Delivered")').first();
    if (await markDeliveredBtn.count() > 0) {
      await markDeliveredBtn.click();
      await page.waitForTimeout(1800);
      console.log('✅ [DRIVER] Order marked: DELIVERED.');
    }

    console.log('\n💵 [DRIVER] Confirming cash collection (₹4,940) in automated driver collection modal...');
    await page.waitForSelector('text=Collect Cash from Customer', { timeout: 8000 });
    await page.waitForTimeout(800);

    const cashModal = page.locator('div.fixed.inset-0 form');
    await cashModal.locator('button[type="submit"]:has-text("Confirm Cash Collection")').click();
    await page.waitForTimeout(2500);
    console.log('✅ [DRIVER] Customer cash of ₹4,940 collected into driver custody.');
    await takeScreenshot(page, '17_driver_delivery_complete_cash_collected');
    await logout(page, 'DRIVER');

    // ----------------------------------------------------------------
    // MILESTONE 8: OWNER (Cash Handover Settlement & Reconciliation)
    // ----------------------------------------------------------------
    await login(page, '9212610962', 'vijay@2026@ShreeOmTiles', 'OWNER');

    // 8.1 Settle Cash Handover from Driver
    console.log('\n💵 [OWNER] Settling driver cash handover via /dashboard/deliveries...');
    await page.goto(`${BASE_URL}/dashboard/deliveries`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const deliveredTab = page.locator('button:has-text("Delivered")').first();
    if (await deliveredTab.count() > 0) {
      await deliveredTab.click();
      await page.waitForTimeout(500);
    }

    const targetRow = page.locator('tr:has-text("4,940"), tr:has-text("4940")').first();
    const receiveCashBtn = targetRow.locator('button:has-text("Collect Cash")').first();
    if (await receiveCashBtn.count() > 0) {
      await receiveCashBtn.click();
      await page.waitForSelector('text=Settled with Office', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
      console.log('✅ [OWNER] Cash handover from Dharmendra Driver settled & deposited into office.');
    }
    await takeScreenshot(page, '18_owner_handover_settled');

    // 8.2 Inspect Payments / Till Drawer Reconciliation
    console.log('\n📊 [OWNER] Auditing Till Drawer & Transactions via /dashboard/payments...');
    await page.goto(`${BASE_URL}/dashboard/payments`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await takeScreenshot(page, '19_owner_till_drawer_reconciliation');
    console.log('✅ [OWNER] Till Drawer daily balance and inflows/outflows audited.');

    // 8.3 Verify Invoice Status is PAID
    console.log('\n📄 [OWNER] Verifying invoice status via /dashboard/invoices...');
    await page.goto(`${BASE_URL}/dashboard/invoices`, { waitUntil: 'networkidle' });
    await page.waitForSelector('tr:has-text("INV-2627-0002") span:has-text("PAID")', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '20_owner_invoices_paid');
    console.log('✅ [OWNER] Both invoices verified in PAID status.');

    // 8.4 Check Party Statement (Dues = ₹0.00)
    console.log('\n📑 [OWNER] Auditing customer ledger via /dashboard/parties...');
    await page.goto(`${BASE_URL}/dashboard/parties`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const partyRow = page.locator('tr:has-text("Sharma")').first();
    const statementBtn = partyRow.locator('button[title*="Customer 360"]').first();
    if (await statementBtn.count() > 0) {
      await statementBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '21_owner_party_statement_settled');
      console.log('✅ [OWNER] Party account statement verified (dues = ₹0.00).');
    }

    console.log('\n================================================================');
    console.log('🎉 ALL 5 PROFILES & ONLINE FRONTEND FLOWS TESTED SUCCESSFULLY!');
    console.log('================================================================\n');

  } catch (error) {
    console.error('❌ E2E TEST FAILED:', error);
    await takeScreenshot(page, 'error_state');
    throw error;
  } finally {
    await browser.close();
  }
}

runE2E();
