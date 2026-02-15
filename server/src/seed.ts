import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import * as schema from './db/schema.js';

async function seed() {
  const neonSql = neon(process.env.DATABASE_URL!);
  const db = drizzle(neonSql, { schema });

  console.log('Migrating manager → admin role...');

  // Migrate existing manager users to admin
  await db.execute(sql`UPDATE users SET role = 'admin' WHERE role = 'manager'`);

  // Remove pending status (no longer valid)
  await db.execute(sql`UPDATE users SET status = 'active' WHERE status = 'pending'`);

  // Upsert Leon as admin with name
  const [leon] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, 'leon@leonbelov.com'));

  if (leon) {
    await db.update(schema.users)
      .set({ role: 'admin', name: 'Leon Belov', sfField: 'Owner.Name', sfValue: 'Leon Belov' })
      .where(eq(schema.users.email, 'leon@leonbelov.com'));
    console.log('Updated Leon → admin');
  }

  // Upsert Marat as admin with name
  const [marat] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, 'marat@leonbelov.com'));

  if (marat) {
    await db.update(schema.users)
      .set({ role: 'admin', name: 'Marat Tsirelson', sfField: 'Owner.Name', sfValue: 'Marat Tsirelson' })
      .where(eq(schema.users.email, 'marat@leonbelov.com'));
    console.log('Updated Marat → admin');
  }

  console.log('Done!');
}

seed().catch(console.error);
