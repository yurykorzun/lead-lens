import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';

export interface ViewAsTarget {
  id: string;
  name: string;
  role: 'loan_officer' | 'agent';
  sfField: string;
  sfValue: string;
}

/** Roles an admin is allowed to view the dashboard as. Admins are excluded on purpose. */
const IMPERSONABLE_ROLES = new Set(['loan_officer', 'agent']);

/**
 * Look up the loan officer or agent an admin asked to view as.
 * Returns null when the id is unknown, the user is not impersonable, or has no
 * Salesforce scope — callers must treat null as a 404 rather than silently
 * falling back to the admin's own (unscoped) view.
 */
export async function findViewAsTarget(userId: string): Promise<ViewAsTarget | null> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user || !IMPERSONABLE_ROLES.has(user.role)) return null;
  if (!user.sfField || !user.sfValue) return null;

  return {
    id: user.id,
    name: user.name ?? '',
    role: user.role as 'loan_officer' | 'agent',
    sfField: user.sfField,
    sfValue: user.sfValue,
  };
}
