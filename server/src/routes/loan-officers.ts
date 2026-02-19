import { Router } from 'express';
import { eq, and, ne, or, ilike, count } from 'drizzle-orm';
import type { CreateLoanOfficerRequest, UpdateLoanOfficerRequest } from '@lead-lens/shared';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { generateAccessCode, hashPassword } from '../services/auth.js';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { countContactsForUsers } from '../services/salesforce/query.js';

const router = Router();

// All routes require admin
router.use(requireAuth, requireAdmin);

// GET /api/loan-officers — list loan officers (paginated)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const search = (req.query.search as string)?.trim() || '';
    const offset = (page - 1) * pageSize;

    const baseConditions = search
      ? and(eq(users.role, 'loan_officer'), or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)))
      : eq(users.role, 'loan_officer');

    const [los, [{ total }]] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          status: users.status,
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

    // Fetch active leads count from Salesforce in parallel
    const loNames = los.map(lo => lo.name ?? '').filter(Boolean);
    const leadCounts = await countContactsForUsers(loNames, 'loan_officer', 'Loan_Partners__c');

    res.json({
      success: true,
      data: {
        items: los.map(lo => ({
          ...lo,
          name: lo.name ?? '',
          createdAt: lo.createdAt?.toISOString() ?? '',
          lastLoginAt: lo.lastLoginAt?.toISOString(),
          activeLeads: leadCounts.get(lo.name ?? '') ?? 0,
        })),
        total,
        page,
        pageSize,
      },
    });
  } catch (err) {
    console.error('List LOs error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// POST /api/loan-officers — create loan officer
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const rawBody = req.body as CreateLoanOfficerRequest;
    const name = rawBody.name?.trim();
    const email = rawBody.email?.trim().toLowerCase();

    if (!name || !email) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Name and email required' } });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Invalid email format' } });
      return;
    }

    const db = getDb();

    // Check if email already exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (existing) {
      res.status(409).json({ success: false, error: { code: 'EXISTS', message: 'A user with this email already exists' } });
      return;
    }

    const accessCode = generateAccessCode();
    const passwordHash = await hashPassword(accessCode);

    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: 'loan_officer',
        status: 'active',
        sfField: 'Loan_Partners__c',
        sfValue: name,
      })
      .returning();

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          createdAt: user.createdAt?.toISOString() ?? '',
          lastLoginAt: user.lastLoginAt?.toISOString(),
        },
        accessCode,
      },
    });
  } catch (err) {
    const cause = err instanceof Error ? (err.cause as { code?: string; message?: string }) : undefined;
    console.error('Create LO error:', { message: (err as Error).message, causeCode: cause?.code, causeMessage: cause?.message });
    if (cause?.code === '23505') {
      res.status(409).json({ success: false, error: { code: 'EXISTS', message: 'A user with this email already exists' } });
      return;
    }
    const message = cause?.message || (err instanceof Error ? err.message : 'Failed to create loan officer');
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message } });
  }
});

// PATCH /api/loan-officers/:id — update loan officer
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const { name, email, status } = req.body as UpdateLoanOfficerRequest;

    const db = getDb();

    // Verify the user exists and is a loan officer
    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, 'loan_officer')));

    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan officer not found' } });
      return;
    }

    // Check email uniqueness if changing
    if (email && email.toLowerCase() !== existing.email) {
      const [emailConflict] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email.toLowerCase()), ne(users.id, id)));

      if (emailConflict) {
        res.status(409).json({ success: false, error: { code: 'EXISTS', message: 'Email already in use' } });
        return;
      }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      updates.name = name;
      updates.sfValue = name; // Keep sfValue in sync with name
    }
    if (email !== undefined) updates.email = email.toLowerCase();
    if (status !== undefined) updates.status = status;

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
        createdAt: updated.createdAt?.toISOString() ?? '',
        lastLoginAt: updated.lastLoginAt?.toISOString(),
      },
    });
  } catch (err) {
    console.error('Update LO error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// POST /api/loan-officers/:id/regenerate-code — generate new access code
router.post('/:id/regenerate-code', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, 'loan_officer')));

    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan officer not found' } });
      return;
    }

    const accessCode = generateAccessCode();
    const passwordHash = await hashPassword(accessCode);

    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, id));

    res.json({
      success: true,
      data: { accessCode },
    });
  } catch (err) {
    console.error('Regenerate code error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// DELETE /api/loan-officers/:id — soft delete (set status=disabled)
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, 'loan_officer')));

    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan officer not found' } });
      return;
    }

    await db
      .update(users)
      .set({ status: 'disabled' })
      .where(eq(users.id, id));

    res.json({ success: true, data: { message: 'Loan officer disabled' } });
  } catch (err) {
    console.error('Delete LO error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

export default router;
