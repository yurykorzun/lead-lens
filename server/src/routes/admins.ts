import { Router } from 'express';
import { eq, count } from 'drizzle-orm';
import type { CreateAdminRequest, UpdateAdminRequest } from '@lead-lens/shared';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../services/auth.js';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  parsePagination, validateNameAndEmail, buildUserListConditions,
  findUserByIdAndRole, checkEmailUniqueness, deleteUserWithAuditCleanup,
  formatUserItem, isUniqueViolation, sendError, sendSuccess,
} from '../services/user-management.js';

const ROLE = 'admin' as const;

const router = Router();
router.use(requireAuth, requireAdmin);

function formatAdminItem(user: Parameters<typeof formatUserItem>[0]) {
  return {
    ...formatUserItem(user),
    sfField: user.sfField ?? undefined,
    sfValue: user.sfValue ?? undefined,
  };
}

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const { page, pageSize, search, offset } = parsePagination(req.query as Record<string, unknown>);
    const conditions = buildUserListConditions(ROLE, search);

    const [admins, [{ total }]] = await Promise.all([
      db.select({ id: users.id, name: users.name, email: users.email, status: users.status, sfField: users.sfField, sfValue: users.sfValue, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt })
        .from(users).where(conditions).orderBy(users.name).limit(pageSize).offset(offset),
      db.select({ total: count() }).from(users).where(conditions),
    ]);

    sendSuccess(res, { items: admins.map(formatAdminItem), total, page, pageSize });
  } catch (err) {
    console.error('List admins error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const raw = req.body as CreateAdminRequest;
    const validated = validateNameAndEmail(raw.name, raw.email);
    if (typeof validated === 'string') { sendError(res, 400, 'VALIDATION', validated); return; }

    if (!raw.password || raw.password.length < 6) {
      sendError(res, 400, 'VALIDATION', 'Password must be at least 6 characters'); return;
    }

    const { name, email } = validated;
    const existing = await checkEmailUniqueness(email, ROLE);
    if (existing) { sendError(res, 409, 'EXISTS', 'An admin with this email already exists'); return; }

    const passwordHash = await hashPassword(raw.password);
    const db = getDb();

    const [user] = await db.insert(users).values({
      email, name, passwordHash, role: ROLE, status: 'active',
      sfField: raw.sfField?.trim() || null,
      sfValue: raw.sfValue?.trim() || null,
    }).returning();

    sendSuccess(res, formatAdminItem(user));
  } catch (err) {
    console.error('Create admin error:', err);
    if (isUniqueViolation(err)) { sendError(res, 409, 'EXISTS', 'A user with this email already exists'); return; }
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const { name, email, status, sfField, sfValue } = req.body as UpdateAdminRequest;

    const existing = await findUserByIdAndRole(id, ROLE);
    if (!existing) { sendError(res, 404, 'NOT_FOUND', 'Admin not found'); return; }

    if (email && email.toLowerCase() !== existing.email) {
      const conflict = await checkEmailUniqueness(email, ROLE, id);
      if (conflict) { sendError(res, 409, 'EXISTS', 'Email already in use by another admin'); return; }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email.toLowerCase();
    if (status !== undefined) updates.status = status;
    if (sfField !== undefined) updates.sfField = sfField || null;
    if (sfValue !== undefined) updates.sfValue = sfValue || null;

    if (Object.keys(updates).length === 0) { sendError(res, 400, 'VALIDATION', 'No fields to update'); return; }

    const db = getDb();
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    sendSuccess(res, formatAdminItem(updated));
  } catch (err) {
    console.error('Update admin error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    if (id === req.userId) {
      sendError(res, 400, 'VALIDATION', 'Cannot delete your own account'); return;
    }

    const existing = await findUserByIdAndRole(id, ROLE);
    if (!existing) { sendError(res, 404, 'NOT_FOUND', 'Admin not found'); return; }

    await deleteUserWithAuditCleanup(id);
    sendSuccess(res, { message: 'Admin deleted' });
  } catch (err) {
    console.error('Delete admin error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

export default router;
