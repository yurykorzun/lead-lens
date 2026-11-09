import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import type { Scope } from './salesforce/query.js';
import { isSfId } from './validate.js';

// Admin "view as": an admin sees one agent's or loan officer's dashboard, read-only.
// Only GET routes accept it - every write still runs as the admin, so viewing as a
// realtor can never complete her task or post a note under her name.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export interface ViewAsUser {
  role: string;
  sfContactId: string | null;
  sfUserId: string | null;
}

export async function findViewAsUser(id: string): Promise<ViewAsUser | null> {
  const [row] = await getDb()
    .select({ role: users.role, sfContactId: users.sfContactId, sfUserId: users.sfUserId })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

/** The scope that user sees on their own dashboard, or null when they have no Salesforce Id */
export function scopeForUser(user: ViewAsUser): Scope | null {
  if (user.role === 'agent' && isSfId(user.sfContactId)) return { role: 'agent', contactId: user.sfContactId };
  if (user.role === 'loan_officer' && isSfId(user.sfUserId)) return { role: 'loan_officer', userId: user.sfUserId };
  return null;
}
