import { Router } from 'express';
import { eq, count } from 'drizzle-orm';
import type { CreateAgentRequest, UpdateAgentRequest } from '@lead-lens/shared';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { generateAccessCode, hashPassword } from '../services/auth.js';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { countRowsForUsers } from '../services/salesforce/query.js';
import { searchRealtors, findRealtor } from '../services/salesforce/realtors.js';
import {
  parsePagination, validateNameAndEmail, buildUserListConditions,
  findUserByIdAndRole, checkEmailUniqueness, deleteUserWithAuditCleanup,
  formatUserItem, isUniqueViolation, sendError, sendSuccess, validateSfId,
} from '../services/user-management.js';
import { sendMail, welcomeEmailHtml } from '../services/mailer.js';

const ROLE = 'agent' as const;
const SF_FIELD = 'MtgPlanner_CRM__Referred_By_Text__c';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const { page, pageSize, search, offset } = parsePagination(req.query as Record<string, unknown>);
    const conditions = buildUserListConditions(ROLE, search);

    const [agents, [{ total }]] = await Promise.all([
      db.select({ id: users.id, name: users.name, email: users.email, status: users.status, sfContactId: users.sfContactId, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt })
        .from(users).where(conditions).orderBy(users.name).limit(pageSize).offset(offset),
      db.select({ total: count() }).from(users).where(conditions),
    ]);

    const sfIds = agents.map(a => a.sfContactId ?? '').filter(Boolean);
    const leadCounts = await countRowsForUsers(ROLE, sfIds);

    sendSuccess(res, {
      items: agents.map(a => ({ ...formatUserItem(a), activeLeads: leadCounts.get(a.sfContactId ?? '') })),
      total, page, pageSize,
    });
  } catch (err) {
    console.error('List agents error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

// Pick the Contact to link instead of typing its Id
router.get('/realtors', async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 80) : '';
    sendSuccess(res, { items: await searchRealtors(q) });
  } catch (err) {
    console.error('Realtor search error:', err);
    sendError(res, 502, 'SALESFORCE', 'Could not search Salesforce');
  }
});

router.get('/realtors/:contactId', async (req: AuthenticatedRequest, res) => {
  try {
    const realtor = await findRealtor(req.params.contactId as string);
    if (!realtor) { sendError(res, 404, 'NOT_FOUND', 'No Salesforce Contact with this Id'); return; }
    sendSuccess(res, realtor);
  } catch (err) {
    console.error('Realtor lookup error:', err);
    sendError(res, 502, 'SALESFORCE', 'Could not reach Salesforce');
  }
});

/**
 * The Contact an agent is linked to, as its 18-character Id, or an error message.
 * An agent with no Contact sees nothing, so a link is required and must exist.
 */
async function resolveContact(value: unknown): Promise<{ id: string } | string> {
  const sfId = validateSfId(value, 'contact');
  if (typeof sfId === 'string') return sfId;
  if (!sfId.id) return "Pick the agent's record in Salesforce - without it they see no borrowers";
  const realtor = await findRealtor(sfId.id);
  if (!realtor) return 'No Salesforce Contact with this Id';
  return { id: realtor.id };
}

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const raw = req.body as CreateAgentRequest;
    const validated = validateNameAndEmail(raw.name, raw.email);
    if (typeof validated === 'string') { sendError(res, 400, 'VALIDATION', validated); return; }

    const { name, email } = validated;
    const contact = await resolveContact(raw.sfContactId);
    if (typeof contact === 'string') { sendError(res, 400, 'VALIDATION', contact); return; }
    const existing = await checkEmailUniqueness(email, ROLE);
    if (existing) { sendError(res, 409, 'EXISTS', 'An agent with this email already exists'); return; }

    const accessCode = generateAccessCode();
    const passwordHash = await hashPassword(accessCode);
    const db = getDb();

    const [user] = await db.insert(users).values({
      email, name, passwordHash, role: ROLE, status: 'active', sfField: SF_FIELD, sfValue: name, sfContactId: contact.id,
    }).returning();

    if (raw.sendWelcome) {
      const loginUrl = process.env.FRONTEND_URL ?? 'https://lead-lens-portal.vercel.app';
      sendMail(email, 'Your Lead Lens Account', welcomeEmailHtml(name, email, accessCode, loginUrl))
        .catch(err => console.error('Welcome email failed (agent):', err));
    }

    sendSuccess(res, { user: formatUserItem(user), accessCode });
  } catch (err) {
    console.error('Create agent error:', err);
    if (isUniqueViolation(err)) { sendError(res, 409, 'EXISTS', 'A user with this email already exists'); return; }
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const { name, email, status, sfContactId } = req.body as UpdateAgentRequest;

    // Not sent: leave the link alone. Sent: it can move to another Contact, never to none.
    let contact: { id: string } | undefined;
    if (sfContactId !== undefined) {
      const resolved = await resolveContact(sfContactId);
      if (typeof resolved === 'string') { sendError(res, 400, 'VALIDATION', resolved); return; }
      contact = resolved;
    }

    const existing = await findUserByIdAndRole(id, ROLE);
    if (!existing) { sendError(res, 404, 'NOT_FOUND', 'Agent not found'); return; }

    if (email && email.toLowerCase() !== existing.email) {
      const conflict = await checkEmailUniqueness(email, ROLE, id);
      if (conflict) { sendError(res, 409, 'EXISTS', 'Email already in use by another agent'); return; }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) { updates.name = name; updates.sfValue = name; }
    if (email !== undefined) updates.email = email.toLowerCase();
    if (status !== undefined) updates.status = status;
    if (contact) updates.sfContactId = contact.id;

    if (Object.keys(updates).length === 0) { sendError(res, 400, 'VALIDATION', 'No fields to update'); return; }

    const db = getDb();
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    sendSuccess(res, formatUserItem(updated));
  } catch (err) {
    console.error('Update agent error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

router.post('/:id/regenerate-code', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const existing = await findUserByIdAndRole(id, ROLE);
    if (!existing) { sendError(res, 404, 'NOT_FOUND', 'Agent not found'); return; }

    const accessCode = generateAccessCode();
    const passwordHash = await hashPassword(accessCode);
    const db = getDb();
    await db.update(users).set({ passwordHash }).where(eq(users.id, id));

    sendSuccess(res, { accessCode });
  } catch (err) {
    console.error('Regenerate agent code error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const existing = await findUserByIdAndRole(id, ROLE);
    if (!existing) { sendError(res, 404, 'NOT_FOUND', 'Agent not found'); return; }

    await deleteUserWithAuditCleanup(id);
    sendSuccess(res, { message: 'Agent deleted' });
  } catch (err) {
    console.error('Delete agent error:', err);
    sendError(res, 500, 'SERVER_ERROR', 'Internal server error');
  }
});

export default router;
