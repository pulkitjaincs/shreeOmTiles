require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function cleanTestDatabase() {
  console.log('🔄 Connecting to test database...');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is missing in backend/.env');
  }

  // Obfuscate credentials for clean logging
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`📍 Target Database: ${maskedUrl}`);

  const pool = new Pool({
    connectionString: dbUrl,
    connectionTimeoutMillis: 15000,
  });

  try {
    // 1. Fetch all public application tables
    console.log('🔍 Identifying public tables...');
    const tablesRes = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename NOT LIKE '_prisma%'
      ORDER BY tablename;
    `);

    const tableNames = tablesRes.rows.map((r) => r.tablename);
    console.log(`📋 Found ${tableNames.length} tables to truncate.`);

    if (tableNames.length === 0) {
      console.log('⚠️ No application tables found to truncate.');
    } else {
      // 2. Truncate all tables with RESTART IDENTITY CASCADE
      const quotedTables = tableNames.map((t) => `"${t}"`).join(', ');
      console.log('🧹 Truncating data from all tables (preserving schemas & columns)...');
      await pool.query(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE;`);
      console.log('✅ All table rows truncated successfully.');
    }

    // 3. Bootstrap single OWNER user
    console.log('👤 Seeding initial OWNER user...');
    const ownerName = 'Vijay Jain';
    const ownerPhone = '9212610962';
    const ownerPassword = 'vijay@2026@ShreeOmTiles';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(ownerPassword, salt);
    const ownerId = crypto.randomUUID();

    await pool.query(
      `INSERT INTO "User" ("id", "name", "phone", "passwordHash", "role", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'OWNER', true, NOW(), NOW())`,
      [ownerId, ownerName, ownerPhone, passwordHash]
    );
    console.log(`✅ Single Owner created: ${ownerName} (${ownerPhone} / ${ownerPassword})`);

    // 4. Initialize CompanySetting
    console.log('🏢 Initializing CompanySetting...');
    const merchantName = process.env.COMPANY_NAME || 'Shree Om Tiles & Sanitaryware';
    const upiId = process.env.UPI_VPA || 'dhraerp@bank';

    await pool.query(
      `INSERT INTO "CompanySetting" ("id", "merchantName", "upiId", "upiAccounts", "updatedAt")
       VALUES ('default', $1, $2, '[]', NOW())
       ON CONFLICT ("id") DO UPDATE SET "merchantName" = $1, "upiId" = $2, "updatedAt" = NOW()`,
      [merchantName, upiId]
    );
    console.log('✅ CompanySetting initialized.');

    // 5. Verify row count
    const countRes = await pool.query(`SELECT COUNT(*)::int as count FROM "User";`);
    console.log(`📊 Post-clean User count: ${countRes.rows[0].count} (Must be exactly 1)`);

    console.log('\n🎉 Test Database cleanly reset. Ready for multi-role frontend testing!\n');
  } catch (err) {
    console.error('❌ Failed to clean database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanTestDatabase();
