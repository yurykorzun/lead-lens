/**
 * Shared utilities for user management routes (admins, loan officers, agents).
 * Extracts duplicate patterns from the three route files.
 */
import { eq, and, ne, or, ilike } from 'drizzle-orm';
import type { Response } from 'express';
import { getDb } from '../db/index.js';
import { users, auditLog } from '../db/schema.js';

// ── Types ──────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'loan_officer' | 'agent';

export interface PaginationParams {
  page: number;
  pageSize: number;
  search: string;
  offset: number;
}

// ── Pagination ─────────────────────────────────────────────────────────

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string) || 25));
  const search = ((query.search as string) ?? '').trim();
  const offset = (page - 1) * pageSize;
  return { page, pageSize, search, offset };
}

// ── Validation ─────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function validateNameAndEmail(name: unknown, email: unknown): { name: string; email: string } | string {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!trimmedName || !trimmedEmail) return 'Name and email required';
  if (!isValidEmail(trimmedEmail)) return 'Invalid email format';

  return { name: trimmedName, email: trimmedEmail };
}

const SF_ID_REGEX = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

// Key prefixes: Contact ids start 003, User ids 005
export const SF_ID_PREFIX = { contact: '003', user: '005' } as const;

/**
 * Validate an optional Salesforce Id from a request body.
 * Returns undefined when the field was not sent, null to clear it,
 * the trimmed Id when valid, or an error message.
 */
export function validateSfId(
  value: unknown,
  kind: keyof typeof SF_ID_PREFIX,
): { id: string | null | undefined } | string {
  if (value === undefined) return { id: undefined };
  if (value === null) return { id: null };
  if (typeof value !== 'string') return 'Salesforce Id must be a string';
  const trimmed = value.trim();
  if (!trimmed) return { id: null };
  if (!SF_ID_REGEX.test(trimmed)) return 'Salesforce Id must be 15 or 18 letters and digits';
  const prefix = SF_ID_PREFIX[kind];
  if (!trimmed.startsWith(prefix)) {
    return `Salesforce ${kind === 'contact' ? 'Contact' : 'User'} Id must start with ${prefix}`;
  }
  return { id: trimmed };
}

// ── DB helpers ─────────────────────────────────────────────────────────

export function buildUserListConditions(role: UserRole, search: string) {
  return search
    ? and(eq(users.role, role), or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)))
    : eq(users.role, role);
}

export async function findUserByIdAndRole(id: string, role: UserRole) {
  const db = getDb();
  const [user] = await db.select().from(users).where(and(eq(users.id, id), eq(users.role, role)));
  return user ?? null;
}

export async function checkEmailUniqueness(email: string, role: UserRole, excludeId?: string) {
  const db = getDb();
  const conditions = excludeId
    ? and(eq(users.email, email.toLowerCase()), eq(users.role, role), ne(users.id, excludeId))
    : and(eq(users.email, email.toLowerCase()), eq(users.role, role));
  const [existing] = await db.select().from(users).where(conditions);
  return existing ?? null;
}

export async function deleteUserWithAuditCleanup(id: string) {
  const db = getDb();
  await db.update(auditLog).set({ userId: null }).where(eq(auditLog.userId, id));
  await db.delete(users).where(eq(users.id, id));
}

// ── Response helpers ───────────────────────────────────────────────────

export function formatUserItem(user: {
  id: string;
  name: string | null;
  email: string;
  status: string;
  sfField?: string | null;
  sfValue?: string | null;
  sfContactId?: string | null;
  sfUserId?: string | null;
  createdAt: Date | null;
  lastLoginAt: Date | null;
}) {
  return {
    id: user.id,
    name: user.name ?? '',
    email: user.email,
    status: user.status,
    ...(user.sfContactId !== undefined && { sfContactId: user.sfContactId }),
    ...(user.sfUserId !== undefined && { sfUserId: user.sfUserId }),
    createdAt: user.createdAt?.toISOString() ?? '',
    lastLoginAt: user.lastLoginAt?.toISOString(),
  };
}

// ── Error handling ─────────────────────────────────────────────────────

export function getDrizzleCause(err: unknown): { code?: string; message?: string } | undefined {
  return err instanceof Error ? (err.cause as { code?: string; message?: string }) : undefined;
}

export function isUniqueViolation(err: unknown): boolean {
  return getDrizzleCause(err)?.code === '23505';
}

export function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

export function sendSuccess<T>(res: Response, data: T) {
  res.json({ success: true, data });
}
