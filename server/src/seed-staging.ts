/**
 * Seeds the staging database with test users for all three roles.
 * Run with: npm run seed:staging
 *
 * Test credentials:
 *   Admin:        test-admin@test.com  / test1234
 *   Loan Officer: test-lo@test.com     / TESTLO1234
 *   Agent:        test-agent@test.com  / TESTAGENT1234
 */
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });

// Use staging DB
process.env.DATABASE_URL = process.env.DATABASE_URL_STAGING;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL_STAGING is not set in .env');
  process.exit(1);
}

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { users } from './db/schema.js';
import { hashPassword } from './services/auth.js';

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

interface SeedUser {
  name: string;
  email: string;
  credential: string;
  role: 'admin' | 'loan_officer' | 'agent';
  sfField: string | null;
  sfValue: string | null;
}

const SEED_USERS: SeedUser[] = [
  {
    name: 'Test Admin',
    email: 'test-admin@test.com',
    credential: 'test1234',
    role: 'admin',
    sfField: 'Owner.Name',
    sfValue: 'Leon Belov',
  },
  {
    name: 'Test LO',
    email: 'test-lo@test.com',
    credential: 'TESTLO1234',
    role: 'loan_officer',
    sfField: 'Loan_Partners__c',
    sfValue: 'Test LO',
  },
  {
    name: 'Test Agent',
    email: 'test-agent@test.com',
    credential: 'TESTAGENT1234',
    role: 'agent',
    sfField: 'MtgPlanner_CRM__Referred_By_Text__c',
    sfValue: 'Test Agent',
  },
];

async function seed() {
  console.log('Seeding staging database...');

  for (const seedUser of SEED_USERS) {
    const hash = await hashPassword(seedUser.credential);

    // Check if user exists
    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, seedUser.email), eq(users.role, seedUser.role)));

    if (existing) {
      // Update password and ensure active
      await db
        .update(users)
        .set({ passwordHash: hash, name: seedUser.name, status: 'active', sfField: seedUser.sfField, sfValue: seedUser.sfValue })
        .where(eq(users.id, existing.id));
      console.log(`  Updated: ${seedUser.role} — ${seedUser.email}`);
    } else {
      await db.insert(users).values({
        name: seedUser.name,
        email: seedUser.email,
        passwordHash: hash,
        role: seedUser.role,
        status: 'active',
        sfField: seedUser.sfField,
        sfValue: seedUser.sfValue,
      });
      console.log(`  Created: ${seedUser.role} — ${seedUser.email}`);
    }
  }

  console.log('Staging seed complete.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
