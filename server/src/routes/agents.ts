import { Router } from 'express';
import { eq, and, ne, or, ilike, count } from 'drizzle-orm';
import type { CreateAgentRequest, UpdateAgentRequest } from '@lead-lens/shared';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { generateAccessCode, hashPassword } from '../services/auth.js';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { countContactsForUsers } from '../services/salesforce/query.js';

const router = Router();

router.use(requireAuth, requireAdmin);

// GET /api/agents — list agents (paginated)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const search = (req.query.search as string)?.trim() || '';
    const offset = (page - 1) * pageSize;

    const baseConditions = search
      ? and(eq(users.role, 'agent'), or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)))
      : eq(users.role, 'agent');

    const [agents, [{ total }]] = await Promise.all([
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
    const agentNames = agents.map(a => a.name ?? '').filter(Boolean);
    const leadCounts = await countContactsForUsers(agentNames, 'agent', 'MtgPlanner_CRM__Referred_By_Text__c');

    res.json({
      success: true,
      data: {
        items: agents.map(a => ({
          ...a,
          name: a.name ?? '',
          createdAt: a.createdAt?.toISOString() ?? '',
          lastLoginAt: a.lastLoginAt?.toISOString(),
          activeLeads: leadCounts.get(a.name ?? '') ?? 0,
        })),
        total,
        page,
        pageSize,
      },
    });
  } catch (err) {
    console.error('List agents error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// POST /api/agents — create agent
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const rawBody = req.body as CreateAgentRequest;
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
        role: 'agent',
        status: 'active',
        sfField: 'MtgPlanner_CRM__Referred_By_Text__c',
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
    console.error('Create agent error:', err);
    const message = err instanceof Error ? err.message : 'Failed to create agent';
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message } });
  }
});

// PATCH /api/agents/:id — update agent
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const { name, email, status } = req.body as UpdateAgentRequest;

    const db = getDb();

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, 'agent')));

    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } });
      return;
    }

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
      updates.sfValue = name;
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
    console.error('Update agent error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// POST /api/agents/:id/regenerate-code
router.post('/:id/regenerate-code', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, 'agent')));

    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } });
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
    console.error('Regenerate agent code error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// DELETE /api/agents/:id — soft delete
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, 'agent')));

    if (!existing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } });
      return;
    }

    await db
      .update(users)
      .set({ status: 'disabled' })
      .where(eq(users.id, id));

    res.json({ success: true, data: { message: 'Agent disabled' } });
  } catch (err) {
    console.error('Delete agent error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

export default router;
