require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function initializeDatabase() {
  console.log('🔄 Starting full database re-initialization...');
  
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in environment or .env');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });

  try {
    // 1. Clean schema reset
    console.log('🧹 Resetting public schema...');
    await pool.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO CURRENT_USER;
      GRANT ALL ON SCHEMA public TO public;
    `);
    console.log('✅ Public schema reset completed.');

    // 2. Read and apply init.sql (derived from schema.prisma)
    const sqlPath = path.join(__dirname, 'init.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Init SQL file not found at: ${sqlPath}`);
    }
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    console.log('📦 Executing schema DDL from init.sql...');
    await pool.query(sql);
    console.log('✅ Tables, Enums, Indexes, and Foreign Keys successfully created.');

    // 3. Hash password for Vijay Jain
    const plainPassword = 'vijay@2026@ShreeOmTiles';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

    const userId = crypto.randomUUID();
    const userName = 'Vijay Jain';
    const userPhone = '9212610962';
    const userRole = 'OWNER';

    console.log(`👤 Creating Owner User: ${userName} (${userPhone})...`);
    await pool.query(
      `INSERT INTO "User" ("id", "name", "phone", "passwordHash", "role", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [userId, userName, userPhone, passwordHash, userRole, true]
    );
    console.log('✅ User successfully created.');

    // 4. Initialize CompanySetting
    const merchantName = process.env.COMPANY_NAME || 'Shree Om Tiles & Sanitaryware';
    const upiId = process.env.UPI_VPA || 'dhraerp@bank';
    const defaultAccounts = upiId ? JSON.stringify([{
      id: 'upi_default',
      upiId: upiId,
      merchantName: merchantName,
      isPrimary: true,
      createdAt: new Date().toISOString()
    }]) : '[]';

    await pool.query(
      `INSERT INTO "CompanySetting" ("id", "upiId", "merchantName", "upiAccounts", "updatedAt")
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT ("id") DO UPDATE SET "upiId" = EXCLUDED."upiId", "merchantName" = EXCLUDED."merchantName", "upiAccounts" = EXCLUDED."upiAccounts", "updatedAt" = NOW()`,
      ['default', upiId, merchantName, defaultAccounts]
    );
    console.log('✅ CompanySetting initialized.');

    // 5. Verification
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`\n📋 Initialized ${tableNames.length} tables in DB:`);
    console.log(tableNames.join(', '));

    const usersRes = await pool.query(`SELECT "id", "name", "phone", "role", "isActive", "passwordHash" FROM "User";`);
    console.log(`\n👥 Users in DB (${usersRes.rows.length} total):`);
    for (const u of usersRes.rows) {
      const match = await bcrypt.compare(plainPassword, u.passwordHash);
      console.log(` - ID: ${u.id} | Name: ${u.name} | Phone: ${u.phone} | Role: ${u.role} | Active: ${u.isActive} | Password verified: ${match}`);
    }

    console.log('\n🎉 Database re-initialization completed successfully!');
  } catch (err) {
    console.error('❌ Re-initialization failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
