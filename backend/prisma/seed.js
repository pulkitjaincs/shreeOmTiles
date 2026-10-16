require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, Role, WarehouseType } = require('@prisma/client');
const bcrypt = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('⛔ Refusing to seed database in production environment. Aborting.');
    process.exit(0);
  }

  console.log('🌱 Starting dhraERP database seeding...');

  const salt = await bcrypt.genSalt(10);
  const ownerPasswordHash = await bcrypt.hash('vijay@2026@ShreeOmTiles', salt);

  // 1. Single Owner User
  const owner = await prisma.user.upsert({
    where: { phone: '9212610962' },
    update: {
      passwordHash: ownerPasswordHash,
      name: 'Vijay Jain',
      role: Role.OWNER,
      isActive: true,
    },
    create: {
      phone: '9212610962',
      name: 'Vijay Jain',
      passwordHash: ownerPasswordHash,
      role: Role.OWNER,
      isActive: true,
    },
  });

  // Ensure only this user exists
  await prisma.user.deleteMany({
    where: { phone: { not: '9212610962' } },
  });

  console.log('✅ Users ready: Owner Vijay Jain (9212610962 / vijay@2026@ShreeOmTiles)');

  // 2. Warehouses & Showrooms
  let showroom = await prisma.warehouse.findFirst({ where: { name: 'Main Showroom' } });
  if (!showroom) {
    showroom = await prisma.warehouse.create({
      data: {
        name: 'Main Showroom',
        address: 'Ground Floor, Commercial Complex, Ring Road',
        type: WarehouseType.SHOWROOM,
      },
    });
  }

  let godownA = await prisma.warehouse.findFirst({ where: { name: 'Godown A - Industrial Area' } });
  if (!godownA) {
    godownA = await prisma.warehouse.create({
      data: {
        name: 'Godown A - Industrial Area',
        address: 'Shed 12, Industrial Area Phase II',
        type: WarehouseType.WAREHOUSE,
      },
    });
  }

  let godownB = await prisma.warehouse.findFirst({ where: { name: 'Godown B - Highway' } });
  if (!godownB) {
    godownB = await prisma.warehouse.create({
      data: {
        name: 'Godown B - Highway',
        address: 'Plot 4, NH Bypass Road',
        type: WarehouseType.WAREHOUSE,
      },
    });
  }

  console.log('✅ Warehouses ready: Main Showroom, Godown A, Godown B');

  // 3. Products
  const productsData = [
    {
      name: 'Somany Bianco Marble 600x600 mm',
      category: 'TILES',
      hsnCode: '69072100',
      unit: 'box',
      attributes: { size: '600x600', finish: 'Glazed Vitrified Glossy', coverage: '15.5 sq.ft/box' },
    },
    {
      name: 'Kajaria Royal Onyx 300x600 mm',
      category: 'TILES',
      hsnCode: '69072200',
      unit: 'box',
      attributes: { size: '300x600', finish: 'Ceramic High Gloss', coverage: '9.68 sq.ft/box' },
    },
    {
      name: 'Hindware Wall-Hung Commode - Studio Collection',
      category: 'SANITARYWARE',
      hsnCode: '69101000',
      unit: 'piece',
      attributes: { color: 'Alpine White', type: 'Rimless Wall-Hung', flush: 'Dual Flush 3/6L' },
    },
    {
      name: 'Jaquar Alive Basin Mixer Tap',
      category: 'BATH_FITTINGS',
      hsnCode: '84818020',
      unit: 'piece',
      attributes: { finish: 'Chrome Plated', cartridge: 'Ceramic Disc', warranty: '10 Years' },
    },
    {
      name: 'Roff New T02 Tile Adhesive 20kg',
      category: 'ADHESIVES_GROUT',
      hsnCode: '35069190',
      unit: 'bag',
      attributes: { weight: '20kg', standard: 'IS 15477 Type 2', application: 'Floor & Wall' },
    },
  ];

  const createdProducts = [];
  for (const p of productsData) {
    let prod = await prisma.product.findFirst({ where: { name: p.name } });
    if (!prod) {
      prod = await prisma.product.create({ data: p });
    }
    createdProducts.push(prod);
  }
  console.log('✅ Products ready (5 categories of tiles & sanitaryware)');

  // 4. Multi-Option Stock Allocation Setup
  // Somany Bianco Marble in 3 locations with lot batches
  const bianco = createdProducts[0];
  const onyx = createdProducts[1];
  const commode = createdProducts[2];
  const mixer = createdProducts[3];
  const adhesive = createdProducts[4];

  const stockSetup = [
    { productId: bianco.id, warehouseId: showroom.id, batchNo: 'BATCH-2024-01', quantity: 45 },
    { productId: bianco.id, warehouseId: godownA.id, batchNo: 'BATCH-2024-01', quantity: 120 },
    { productId: bianco.id, warehouseId: godownB.id, batchNo: 'BATCH-2024-02', quantity: 80 },

    { productId: onyx.id, warehouseId: showroom.id, batchNo: 'BATCH-2024-03', quantity: 30 },
    { productId: onyx.id, warehouseId: godownA.id, batchNo: 'BATCH-2024-03', quantity: 90 },

    { productId: commode.id, warehouseId: showroom.id, batchNo: 'LOT-2024', quantity: 8 },
    { productId: commode.id, warehouseId: godownA.id, batchNo: 'LOT-2024', quantity: 24 },

    { productId: mixer.id, warehouseId: showroom.id, batchNo: 'LOT-2024', quantity: 15 },
    { productId: mixer.id, warehouseId: godownA.id, batchNo: 'LOT-2024', quantity: 35 },

    { productId: adhesive.id, warehouseId: godownA.id, batchNo: 'LOT-2024', quantity: 100 },
  ];

  for (const s of stockSetup) {
    const existing = await prisma.stockLedger.findFirst({
      where: { productId: s.productId, warehouseId: s.warehouseId, batchNo: s.batchNo },
    });
    if (!existing) {
      await prisma.stockLedger.create({ data: s });
    } else {
      await prisma.stockLedger.update({ where: { id: existing.id }, data: { quantity: s.quantity } });
    }
  }
  console.log('✅ Multi-option stock ledgers ready across Showroom & Godowns');

  // 5. Parties / Customers
  const partiesData = [
    {
      name: 'Rajesh Sharma (Contractor)',
      phone: '9811122233',
      address: 'Plot 12, Sector 14, Rohini, Delhi',
      gstin: '07AAAAA1111A1Z1',
    },
    {
      name: 'Vikas Gupta (Homeowner)',
      phone: '9822233344',
      address: 'House 45, Model Town, Delhi',
    },
    {
      name: 'Apex Builders Pvt Ltd',
      phone: '9833344455',
      address: '4th Floor, Barakhamba Road, Connaught Place, New Delhi',
      gstin: '07BBBBB2222B2Z2',
    },
  ];

  for (const p of partiesData) {
    const existing = await prisma.party.findFirst({ where: { phone: p.phone } });
    if (!existing) {
      await prisma.party.create({ data: p });
    }
  }
  console.log('✅ Customer parties ready');

  console.log('🎉 Seeding successfully completed!');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
