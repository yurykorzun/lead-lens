import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema.js';

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  console.log('Seeding loan_officer_directory...');

  // Managers scope by Owner.Name (standard Contact owner field)
  // Partners scope by Leon_Loan_Partner__c or Marat__c (custom picklist fields)
  await db.insert(schema.loanOfficerDirectory).values([
    {
      email: 'leon@leonbelov.com',
      name: 'Leon Belov',
      role: 'manager',
      sfField: 'Owner.Name',
      sfValue: 'Leon Belov',
      active: true,
    },
    {
      email: 'marat@leonbelov.com',
      name: 'Marat Tsirelson',
      role: 'manager',
      sfField: 'Owner.Name',
      sfValue: 'Marat Tsirelson',
      active: true,
    },
    {
      email: 'korzun.yury@gmail.com',
      name: 'Yury Korzun',
      role: 'loan_officer',
      sfField: 'Leon_Loan_Partner__c',
      sfValue: 'Yury Korzun',
      active: true,
    },
  ]).onConflictDoNothing();

  // Fix existing entries
  await db.update(schema.loanOfficerDirectory)
    .set({ sfField: 'Owner.Name', sfValue: 'Leon Belov' })
    .where(eq(schema.loanOfficerDirectory.email, 'leon@leonbelov.com'));

  await db.update(schema.loanOfficerDirectory)
    .set({ sfField: 'Owner.Name', sfValue: 'Marat Tsirelson' })
    .where(eq(schema.loanOfficerDirectory.email, 'marat@leonbelov.com'));

  await db.update(schema.users)
    .set({ sfField: 'Owner.Name', sfValue: 'Leon Belov' })
    .where(eq(schema.users.email, 'leon@leonbelov.com'));

  await db.update(schema.users)
    .set({ sfField: 'Owner.Name', sfValue: 'Marat Tsirelson' })
    .where(eq(schema.users.email, 'marat@leonbelov.com'));

  console.log('Done!');
}

seed().catch(console.error);
