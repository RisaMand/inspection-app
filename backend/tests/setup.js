process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/test_db';
process.env.JWT_SECRET = 'test_secret';
process.env.JWT_EXPIRES_IN = '8h';
process.env.DATABASE_SSL = 'false';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.BCRYPT_SALT_ROUNDS = '1';
process.env.MAX_JSON_BODY_SIZE = '10mb';
process.env.LOG_LEVEL = 'error';
// Real-shaped but fake -- the actual Supabase client is replaced by the
// manual mock in __mocks__/@supabase/supabase-js.js, so these values never
// reach a real network call. They just need to be present (env.js fails
// fast if they're missing) and well-formed enough for createClient() to
// construct without throwing.
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test_secret_key';
process.env.SUPABASE_STORAGE_BUCKET = 'inspection-photos-test';

const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const db = newDb();
let uuidCounter = 0;
db.public.registerFunction({
  name: 'uuid_generate_v4',
  returns: 'uuid',
  implementation: () => {
    uuidCounter++;
    var b = require('crypto').randomBytes(16);
    // Set version 4 and variant bits
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var hex = b.toString('hex');
    return hex.slice(0,8) + '-' + hex.slice(8,12) + '-' + hex.slice(12,16) + '-' + hex.slice(16,20) + '-' + hex.slice(20,32);
  },
  impure: true,
});

// Run migrations on the in-memory db
const runMigration = (filename) => {
  const sql = fs.readFileSync(path.join(__dirname, '../db/migrations', filename), 'utf-8')
    .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/g, '');
  db.public.none(sql);
};

runMigration('001_init.sql');
runMigration('002_sessions.sql');
runMigration('003_products.sql');
runMigration('004_inspections_updates.sql');
runMigration('005_session_visit_data.sql');
runMigration('006_products_barcode_nullable.sql');
runMigration('007_products_name_nullable.sql');
runMigration('008_marketed_by.sql');

// Use synchronous bcrypt hash so seeds complete before tests
const hash = bcrypt.hashSync('password123', 1);

const mockPg = db.adapters.createPg();
const seedPool = new mockPg.Pool();

// Seed users synchronously via pg-mem's synchronous query support
db.public.none(
  "INSERT INTO users (id, full_name, email, password_hash, role) VALUES " +
  "('11111111-1111-1111-1111-111111111111', 'Admin User', 'admin@compliance.local', '" + hash + "', 'ADMIN'), " +
  "('22222222-2222-2222-2222-222222222222', 'Official User', 'official@compliance.local', '" + hash + "', 'OFFICIAL'), " +
  "('33333333-3333-3333-3333-333333333333', 'Inspector One', 'inspector@compliance.local', '" + hash + "', 'INSPECTOR'), " +
  "('44444444-4444-4444-4444-444444444444', 'Inspector Two', 'inspector2@compliance.local', '" + hash + "', 'INSPECTOR')"
);

db.public.none(
  "INSERT INTO rule_configs (version, rules, status, effective_from) VALUES " +
  "('LMR-2011-v1', '[{\"rule\":\"MRP\",\"required\":true}]', 'ACTIVE', '2024-01-01T00:00:00Z')"
);

jest.mock('pg', () => {
  return {
    Pool: mockPg.Pool,
    Client: mockPg.Client
  };
});
