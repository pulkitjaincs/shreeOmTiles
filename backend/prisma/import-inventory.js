require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const targetDbUrl = process.env.TARGET_DATABASE_URL || process.argv[3] || process.env.DATABASE_URL;

if (!targetDbUrl) {
  console.error('❌ Error: DATABASE_URL is not set in environment or arguments');
  process.exit(1);
}

// Obfuscate for logging
const maskedUrl = targetDbUrl.replace(/:([^:@]+)@/, ':****@');
console.log(`🔌 Connecting to target database: ${maskedUrl}`);

const pool = new Pool({ connectionString: targetDbUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function classifyCategory(name, rawCategory) {
  const upperName = name.toUpperCase();
  const upperCat = (rawCategory || '').toUpperCase().trim();

  // 1. Explicit Category
  if (upperCat === 'TILES') {
    return 'Tiles';
  }
  if (upperCat === 'SANATRY' || upperCat === 'SANITARY' || upperCat === 'SANITARYWARE') {
    return 'Sanitaryware';
  }
  if (upperCat === 'ADHESIVE' || upperCat === 'ADHESIVES') {
    return 'Adhesives';
  }

  // 2. Inferred for Blank Categories
  if (
    upperName.includes('SINK') ||
    upperName.includes('UBIT') ||
    upperName.includes('HANDMADE') ||
    upperName.includes('HANDEMADE') ||
    upperName.includes('HANDE MADE') ||
    upperName.includes('MACHINE MADE')
  ) {
    return 'Sanitaryware';
  }

  if (upperName.includes('SS PENCIL') || upperName.includes('SPACER')) {
    return 'Fittings';
  }

  if (
    upperName.includes('ADHESIVE') ||
    upperName.includes('EPOXY') ||
    upperName.includes('GROUT') ||
    upperName.includes('FIXER') ||
    upperName.includes('FERROUS') ||
    upperName.includes('LATICRETE') ||
    upperName.includes('MAPEI') ||
    upperName.includes('KERAEPOXY') ||
    upperName.includes('KERAFLEX') ||
    upperName.includes('TAMMY') ||
    upperName.includes('FILLAR') ||
    upperName.includes('ADMIX') ||
    upperName.includes('PUA 212') ||
    upperName.includes('SP 100') ||
    upperName.includes('SP100')
  ) {
    return 'Adhesives';
  }

  return 'Tiles';
}

function normalizeUnit(rawUnit, category, name) {
  const u = (rawUnit || '').trim().toUpperCase();
  if (u === 'BOX' || u === 'BOXES') return 'box';
  if (u === 'PIECES' || u === 'PIECE' || u === 'PCS') return 'piece';
  if (u === 'SET' || u === 'SETS') return 'set';
  if (u === 'SQFT' || u === 'SQ.FT') return 'sqft';
  if (u === 'BAGS' || u === 'BAG') return 'bag';
  if (u === 'CANS' || u === 'CAN') return 'can';
  if (u === 'BOTTLES' || u === 'BOTTLE') return 'bottle';
  if (u === 'KILOGRAMS' || u === 'KG' || u === 'KGS') return 'kg';
  if (u === 'PACKS' || u === 'PACK') return 'pack';

  // Fallbacks if blank in CSV
  if (category === 'Tiles') return 'box';
  if (category === 'Sanitaryware') return 'piece';
  if (category === 'Fittings') return 'piece';
  if (name.toUpperCase().includes('KG')) return 'bag';
  return 'box';
}

function resolveHsnCode(category) {
  switch (category) {
    case 'Tiles':
      return '6907';
    case 'Sanitaryware':
      return '6910';
    case 'Adhesives':
      return '3506';
    case 'Fittings':
      return '7326';
    default:
      return '6907';
  }
}

function extractAttributes(name, category, existingAttrs = {}) {
  const attrs = { ...existingAttrs };
  const upper = name.toUpperCase();

  // Extract dimensions (e.g. 800*2400, 600*1200, 30*18, 45*20, 2*1)
  if (!attrs.size) {
    const sizeMatch = name.match(/(\d+\s*[\*xX]\s*\d+)/);
    if (sizeMatch) {
      attrs.size = sizeMatch[1].replace(/\s+/g, '');
    }
  }

  // Weight / packaging for adhesives / chemicals (e.g. 20 KG, 5KG, 400 ML)
  if (!attrs.packageSize) {
    const weightMatch = name.match(/(\d+(?:\.\d+)?\s*(?:KG|LTR|ML|MM))/i);
    if (weightMatch) {
      attrs.packageSize = weightMatch[1].toUpperCase();
    }
  }

  // Finish detection for tiles
  if (!attrs.finish && category === 'Tiles') {
    const finishes = ['GLOSSY', 'MATT', 'DECOR', 'CARVING', 'BOOKMATCH', 'SATIN', 'POLISHED', 'RUSTIC', 'HIGH GLOSS'];
    for (const f of finishes) {
      if (upper.includes(f)) {
        attrs.finish = f.charAt(0) + f.slice(1).toLowerCase();
        break;
      }
    }
  }

  return attrs;
}

async function runImport() {
  const csvPath = process.argv[2] || path.join(__dirname, '../../scripts/inventory_master.csv');
  console.log(`📦 Loading inventory master from: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found at: ${csvPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length <= 1) {
    console.error('❌ CSV contains no data rows.');
    process.exit(1);
  }

  console.log(`📄 Found ${lines.length - 1} data rows to process.`);

  // 1. Preload existing products and stock ledgers to avoid slow round trips
  console.log('🔄 Preloading existing products from database...');
  const existingProducts = await prisma.product.findMany();
  const productMap = new Map();
  existingProducts.forEach((p) => {
    productMap.set(p.name.trim().toLowerCase(), p);
  });
  console.log(`✓ Cached ${existingProducts.length} existing products.`);

  const existingLedgers = await prisma.stockLedger.findMany({
    where: { batchNo: 'MASTER-IMPORT' },
  });
  const ledgerMap = new Map();
  existingLedgers.forEach((l) => {
    ledgerMap.set(l.productId, l);
  });
  console.log(`✓ Cached ${existingLedgers.length} existing MASTER-IMPORT stock ledgers.`);

  let productsCreated = 0;
  let productsUpdated = 0;
  let stockUpdated = 0;
  let totalStockInwarded = 0;
  let skippedRows = 0;

  const categoryStats = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = parseCSVLine(line);

    if (cols.length < 3) {
      skippedRows++;
      continue;
    }

    const rawName = cols[0].replace(/^["']|["']$/g, '').trim();
    const rawCategory = cols[1] ? cols[1].replace(/^["']|["']$/g, '').trim() : '';
    const rawQtyStr = (cols[2] || '0').replace(/[^0-9.-]/g, '').trim();
    const rawQty = rawQtyStr ? parseFloat(rawQtyStr) : 0;
    const rawUnit = cols[3] ? cols[3].replace(/^["']|["']$/g, '').trim() : '';

    if (!rawName) {
      skippedRows++;
      continue;
    }

    const category = classifyCategory(rawName, rawCategory);
    const unit = normalizeUnit(rawUnit, category, rawName);
    const hsnCode = resolveHsnCode(category);

    categoryStats[category] = (categoryStats[category] || 0) + 1;

    try {
      const lookupKey = rawName.toLowerCase();
      let product = productMap.get(lookupKey);

      if (!product) {
        const attributes = extractAttributes(rawName, category);
        product = await prisma.product.create({
          data: {
            name: rawName,
            category,
            unit,
            hsnCode,
            attributes,
          },
        });
        productMap.set(lookupKey, product);
        productsCreated++;
      } else {
        const attributes = extractAttributes(rawName, category, product.attributes || {});
        product = await prisma.product.update({
          where: { id: product.id },
          data: {
            category,
            unit,
            hsnCode: product.hsnCode || hsnCode,
            attributes,
          },
        });
        productMap.set(lookupKey, product);
        productsUpdated++;
      }

      // Direct product stock ledger entry (no warehouse requirement)
      const existingLedger = ledgerMap.get(product.id);

      if (existingLedger) {
        await prisma.stockLedger.update({
          where: { id: existingLedger.id },
          data: {
            quantity: rawQty,
          },
        });
      } else {
        const newLedger = await prisma.stockLedger.create({
          data: {
            productId: product.id,
            warehouseId: null,
            batchNo: 'MASTER-IMPORT',
            quantity: rawQty,
          },
        });
        ledgerMap.set(product.id, newLedger);
      }

      stockUpdated++;
      totalStockInwarded += rawQty;

      if (i % 50 === 0 || i === lines.length - 1) {
        process.stdout.write(`⏳ Processed ${i}/${lines.length - 1} items...\r`);
      }
    } catch (err) {
      console.error(`\n⚠️ Error processing row #${i} [${rawName}]:`, err.message);
    }
  }

  console.log('\n=============================================');
  console.log('✅ INVENTORY MASTER IMPORT COMPLETED SUCCESSFULLY');
  console.log('=============================================');
  console.log(`• Products Created:      ${productsCreated}`);
  console.log(`• Products Updated:      ${productsUpdated}`);
  console.log(`• Stock Lots Updated:    ${stockUpdated}`);
  console.log(`• Net Stock Volume:      ${totalStockInwarded.toLocaleString()} units`);
  console.log(`• Skipped Rows:          ${skippedRows}`);
  console.log('\n--- Final Category Breakdown ---');
  console.table(categoryStats);
  console.log('=============================================');

  await prisma.$disconnect();
  await pool.end();
}

runImport().catch(async (e) => {
  console.error('Fatal import error:', e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
