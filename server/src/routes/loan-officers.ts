import { Router } from 'express';
import { eq, count } from 'drizzle-orm';
import type { CreateLoanOfficerRequest, UpdateLoanOfficerRequest } from '@lead-lens/shared';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { generateAccessCode, hashPassword } from '../services/auth.js';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { countContactsForUsers } from '../services/salesforce/query.js';
import {
  parsePagination, validateNameAndEmail, buildUserListConditions,
  findUserByIdAndRole, checkEmailUniqueness, deleteUserWithAuditCleanup,
  formatUserItem, isUniqueViolation, sendError, sendSuccess,
} from '../services/user-management.js';

const ROLE = 'loan_officer' as const;
const SF_FIELD = 'Loan_Partners__c';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const { page, pageSize, search, offset } = parsePagination(req.query as Record<string, unknown>);
    const conditions = buildUserListConditions(ROLE, search);

    const [los, [{ total }]] = await Promise.all([
      db.select({ id: users.id, name: users.name, email: users.email, status: users.status, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt })
        .from(users).where(conditions).orderBy(users.name).limit(pageSize).offset(offset),
      db.select({ total: count() }).from(users).where(conditions),
    ]);

    const loNames = los.map(lo => lo.name ?? '').filter(Boolean);
    const leadCounts = await countContactsForUsers(loNames, ROLE, SF_FIELD);

    sendSuccess(res, {
      items: los.map(lo => ({ ...formatUserItem(lo), activeLeads: leadCounts.get(lo.name ?? '') ?? 0 })),
      total, page, pageSize,
    });
  } catch (err) {
    console.error('List LOs error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const raw = req.body as CreateLoanOfficerRequest;
    const validated = validateNameAndEmail(raw.name, raw.email);
    if (typeof validated === 'string') { sendError(res, 400, 'VALIDATION', validated); return; }

    const { name, email } = validated;
    const existing = await checkEmailUniqueness(email, ROLE);
    if (existing) { sendError(res, 409, 'EXISTS', 'A loan officer with this email already exists'); return; }

    const accessCode = generateAccessCode();
    const passwordHash = await hashPassword(accessCode);
    const db = getDb();

    const [user] = await db.insert(users).values({
      email, name, passwordHash, role: ROLE, status: 'active', sfField: SF_FIELD, sfValue: name,
    }).returning();

    sendSuccess(res, { user: formatUserItem(user), accessCode });
  } catch (err) {
    console.error('Create LO error:', err);
    if (isUniqueViolation(err)) { sendError(res, 409, 'EXISTS', 'A user with this email already exists'); return; }
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const { name, email, status } = req.body as UpdateLoanOfficerRequest;

    const existing = await findUserByIdAndRole(id, ROLE);
    if (!existing) { sendError(res, 404, 'NOT_FOUND', 'Loan officer not found'); return; }

    if (email && email.toLowerCase() !== existing.email) {
      const conflict = await checkEmailUniqueness(email, ROLE, id);
      if (conflict) { sendError(res, 409, 'EXISTS', 'Email already in use by another loan officer'); return; }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) { updates.name = name; updates.sfValue = name; }
    if (email !== undefined) updates.email = email.toLowerCase();
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) { sendError(res, 400, 'VALIDATION', 'No fields to update'); return; }

    const db = getDb();
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    sendSuccess(res, formatUserItem(updated));
  } catch (err) {
    console.error('Update LO error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

router.post('/:id/regenerate-code', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const existing = await findUserByIdAndRole(id, ROLE);
    if (!existing) { sendError(res, 404, 'NOT_FOUND', 'Loan officer not found'); return; }

    const accessCode = generateAccessCode();
    const passwordHash = await hashPassword(accessCode);
    const db = getDb();
    await db.update(users).set({ passwordHash }).where(eq(users.id, id));

    sendSuccess(res, { accessCode });
  } catch (err) {
    console.error('Regenerate code error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const existing = await findUserByIdAndRole(id, ROLE);
    if (!existing) { sendError(res, 404, 'NOT_FOUND', 'Loan officer not found'); return; }

    await deleteUserWithAuditCleanup(id);
    sendSuccess(res, { message: 'Loan officer deleted' });
  } catch (err) {
    console.error('Delete LO error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

export default router;
