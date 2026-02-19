import { Router } from 'express';
import { eq, and, ne, or, ilike, count } from 'drizzle-orm';
import type { CreateAdminRequest, UpdateAdminRequest } from '@lead-lens/shared';
import { getDb } from '../db/index.js';
import { users, auditLog } from '../db/schema.js';
import { hashPassword } from '../services/auth.js';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireAdmin);

// GET /api/admins — list admins (paginated)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const search = (req.query.search as string)?.trim() || '';
    const offset = (page - 1) * pageSize;

    const baseConditions = search
      ? and(eq(users.role, 'admin'), or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)))
      : eq(users.role, 'admin');

    const [admins, [{ total }]] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          status: users.status,
          sfField: users.sfField,
          sfValue: users.sfValue,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(baseConditions)
        .orderBy(users.name)
        .limit(pageSize)
        .offset(offset),
      db
        .select({ total: count() })
        .from(users)
        .where(baseConditions),
    ]);

    res.json({
      success: true,
      data: {
        items: admins.map(a => ({
          ...a,
          name: a.name ?? '',
          sfField: a.sfField ?? undefined,
          sfValue: a.sfValue ?? undefined,
          createdAt: a.createdAt?.toISOString() ?? '',
          lastLoginAt: a.lastLoginAt?.toISOString(),
        })),
        total,
        page,
        pageSize,
      },
    });
  } catch (err) {
    console.error('List admins error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// POST /api/admins — create admin
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const rawBody = req.body as CreateAdminRequest;
    const name = rawBody.name?.trim();
    const email = rawBody.email?.trim().toLowerCase();
    const password = rawBody.password;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Name, email, and password required' } });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Invalid email format' } });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Password must be at least 6 characters' } });
      return;
    }

    const db = getDb();

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.role, 'admin')));

    if (existing) {
      res.status(409).json({ success: false, error: { code: 'EXISTS', message: 'An admin with this email already exists' } });
      return;
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash,
        role: 'admin',
        status: 'active',
        sfField: rawBody.sfField?.trim() || null,
        sfValue: rawBody.sfValue?.trim() || null,
      })
      .returning();

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name ?? '',
        email: user.email,
        status: user.status,
        sfField: user.sfField ?? undefined,
        sfValue: user.sfValue ?? undefined,
        createdAt: user.createdAt?.toISOString() ?? '',
        lastLoginAt: user.lastLoginAt?.toISOString(),
      },
    });
  } catch (err) {
    const cause = err instanceof Error ? (err.cause as { code?: string; message?: string }) : undefined;
    console.error('Create admin error:', { message: (err as Error).message, causeCode: cause?.code, causeMessage: cause?.message });
    if (cause?.code === '23505') {
      res.status(409).json({ success: false, error: { code: 'EXISTS', message: 'A user with this email already exists' } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: cause?.message || 'Internal server error' } });
  }
});

// PATCH /api/admins/:id — update admin
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const { name, email, status, sfField, sfValue } = req.body as UpdateAdminRequest;

    const db = getDb();

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, 'admin')));

    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Admin not found' } });
      return;
    }

    if (email && email.toLowerCase() !== existing.email) {
      const [emailConflict] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email.toLowerCase()), eq(users.role, 'admin'), ne(users.id, id)));

      if (emailConflict) {
        res.status(409).json({ success: false, error: { code: 'EXISTS', message: 'Email already in use by another admin' } });
        return;
      }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email.toLowerCase();
    if (status !== undefined) updates.status = status;
    if (sfField !== undefined) updates.sfField = sfField || null;
    if (sfValue !== undefined) updates.sfValue = sfValue || null;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'No fields to update' } });
      return;
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();

    res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name ?? '',
        email: updated.email,
        status: updated.status,
        sfField: updated.sfField ?? undefined,
        sfValue: updated.sfValue ?? undefined,
        createdAt: updated.createdAt?.toISOString() ?? '',
        lastLoginAt: updated.lastLoginAt?.toISOString(),
      },
    });
  } catch (err) {
    console.error('Update admin error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// DELETE /api/admins/:id — hard delete
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;

    // Prevent self-delete
    if (id === req.userId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Cannot delete your own account' } });
      return;
    }

    const db = getDb();

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, 'admin')));

    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Admin not found' } });
      return;
    }

    // Nullify audit_log FK before deleting
    await db
      .update(auditLog)
      .set({ userId: null })
      .where(eq(auditLog.userId, id));

    await db
      .delete(users)
      .where(eq(users.id, id));

    res.json({ success: true, data: { message: 'Admin deleted' } });
  } catch (err) {
    console.error('Delete admin error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

export default router;
