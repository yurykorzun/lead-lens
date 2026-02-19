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
  createdAt: Date | null;
  lastLoginAt: Date | null;
}) {
  return {
    id: user.id,
    name: user.name ?? '',
    email: user.email,
    status: user.status,
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
