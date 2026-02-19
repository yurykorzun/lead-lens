/**
 * Playwright global setup for staging tests.
 * Resets the staging DB to a clean state before tests run.
 */
import dotenv from 'dotenv';
import { resolve } from 'path';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, notInArray } from 'drizzle-orm';
import { users, auditLog, sfMetadataCache } from '../../server/src/db/schema.js';
import { hashPassword } from '../../server/src/services/auth.js';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });

const SEED_EMAILS = ['test-admin@test.com', 'test-lo@test.com', 'test-agent@test.com'];

function getStagingDb() {
  const dbUrl = process.env.DATABASE_URL_STAGING;
  if (!dbUrl) throw new Error('DATABASE_URL_STAGING not set');
  return drizzle(neon(dbUrl));
}

export async function resetStagingDb() {
  const db = getStagingDb();

  // Clear audit_log and metadata cache
  await db.delete(auditLog);
  await db.delete(sfMetadataCache);

  // Delete test-created users (keep seed users)
  await db.delete(users).where(notInArray(users.email, SEED_EMAILS));

  // Re-hash and upsert seed users to ensure they exist and are active
  const seedUsers = [
    { name: 'Test Admin', email: 'test-admin@test.com', credential: 'test1234', role: 'admin' as const, sfField: 'Owner.Name', sfValue: 'Leon Belov' },
    { name: 'Test LO', email: 'test-lo@test.com', credential: 'TESTLO1234', role: 'loan_officer' as const, sfField: 'Loan_Partners__c', sfValue: 'Test LO' },
    { name: 'Test Agent', email: 'test-agent@test.com', credential: 'TESTAGENT1234', role: 'agent' as const, sfField: 'MtgPlanner_CRM__Referred_By_Text__c', sfValue: 'Test Agent' },
  ];

  for (const su of seedUsers) {
    const hash = await hashPassword(su.credential);
    const [existing] = await db.select().from(users).where(and(eq(users.email, su.email), eq(users.role, su.role)));

    if (existing) {
      await db.update(users).set({ passwordHash: hash, status: 'active', name: su.name }).where(eq(users.id, existing.id));
    } else {
      await db.insert(users).values({
        name: su.name,
        email: su.email,
        passwordHash: hash,
        role: su.role,
        status: 'active',
        sfField: su.sfField,
        sfValue: su.sfValue,
      });
    }
  }
}

export default async function globalSetup() {
  console.log('Resetting staging database...');
  await resetStagingDb();
  console.log('Staging database reset complete.');
}
