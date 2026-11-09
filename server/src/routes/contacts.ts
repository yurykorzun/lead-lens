import { Router, type Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { NOTE_MAX_LENGTH, type ContactFilters, type ContactNote, type RealtorTask } from '@lead-lens/shared';
import { findViewAsUser, isUuid, scopeForUser } from '../services/view-as.js';
import { getDb } from '../db/index.js';
import { notes } from '../db/schema.js';
import { executeSoql, buildContactQuery, mapRow, isRowInScope, type Scope } from '../services/salesforce/query.js';
import { isIsoDate, isSfId } from '../services/validate.js';
import { listBorrowerTasks, listOpenTasks, findTaskForRealtor, completeTask, mapTask } from '../services/salesforce/tasks.js';

// Read-only toward Salesforce, with ONE exception. On lgc-ci a new Referred By on a lead,
// or a Task completed with an "update realtor" box ticked, texts the realtor, so Lead Lens
// changes no record except this: the realtor marks one of her own realtor tasks Completed
// (services/salesforce/tasks.ts - a constant body, Status only). Notes go to the Lead Lens
// database only.
const router = Router();

// null when the user has no Salesforce Id yet - they see nothing rather than everything
export function scopeFor(req: AuthenticatedRequest): Scope | null {
  if (req.userRole === 'admin') return { role: 'admin' };
  if (!isSfId(req.sfId)) return null;
  if (req.userRole === 'agent') return { role: 'agent', contactId: req.sfId };
  if (req.userRole === 'loan_officer') return { role: 'loan_officer', userId: req.sfId };
  return null;
}

function sendNoScope(res: Response, viewingAs: boolean) {
  const message = viewingAs
    ? 'This user is not linked to Salesforce yet.'
    : 'Your account is not linked to Salesforce yet. Contact your admin.';
  res.status(403).json({ success: false, error: { code: 'NO_SCOPE', message } });
}

interface ReadScope { scope: Scope; viewingAs: boolean }

/**
 * The scope for a GET. An admin may pass ?asUser=<Lead Lens user id> to see exactly what
 * that agent or loan officer sees. Only GET routes call this, so writes never run as them.
 */
async function readScope(req: AuthenticatedRequest, res: Response): Promise<ReadScope | null> {
  const asUser = req.query.asUser;
  if (asUser === undefined) {
    const scope = scopeFor(req);
    if (!scope) { sendNoScope(res, false); return null; }
    return { scope, viewingAs: false };
  }
  if (req.userRole !== 'admin') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can view as another user' } });
    return null;
  }
  if (!isUuid(asUser)) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'asUser must be a user id' } });
    return null;
  }
  const user = await findViewAsUser(asUser);
  if (!user || (user.role !== 'agent' && user.role !== 'loan_officer')) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return null;
  }
  const scope = scopeForUser(user);
  if (!scope) { sendNoScope(res, true); return null; }
  return { scope, viewingAs: true };
}

// Viewing as a realtor shows her steps, but the admin cannot complete them
const readOnly = (tasks: RealtorTask[]) => tasks.map(t => ({ ...t, canComplete: false }));

router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const read = await readScope(req, res);
    if (!read) return;
    const { scope } = read;

    const filters = req.query as unknown as ContactFilters;
    if ((filters.dateFrom && !isIsoDate(filters.dateFrom)) || (filters.dateTo && !isIsoDate(filters.dateTo))) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Dates must be YYYY-MM-DD' } });
      return;
    }

    const { dataQuery, countQuery, page, pageSize, maxPage } = buildContactQuery(scope, {
      search: filters.search,
      status: filters.status,
      temperature: filters.temperature,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      page: filters.page ? Number(filters.page) : 1,
      pageSize: filters.pageSize ? Number(filters.pageSize) : 50,
    });

    const [dataResult, countResult] = await Promise.all([
      executeSoql(dataQuery),
      executeSoql(countQuery),
    ]);

    const totalCount = countResult.totalSize;
    res.json({
      success: true,
      data: dataResult.records.map(mapRow),
      pagination: {
        page,
        pageSize,
        totalCount,
        // SOQL OFFSET stops at 2000, so pages past that are unreachable - narrow with filters instead
        totalPages: Math.min(Math.ceil(totalCount / pageSize), maxPage),
      },
    });
  } catch (err) {
    console.error('Contacts GET error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch contacts' } });
  }
});

// ── Notes ──────────────────────────────────────────────────────────────
// Kept in Lead Lens only. Everyone who can see a borrower on their dashboard can read and
// add its notes: the realtor, the loan officer who owns it, and admins. Checked against
// Salesforce on every call, so a realtor whose referral moves elsewhere loses access.

function toNote(row: typeof notes.$inferSelect, userId: string | undefined): ContactNote {
  return {
    id: row.id,
    body: row.body,
    authorName: row.authorName,
    authorRole: row.authorRole as ContactNote['authorRole'],
    createdAt: row.createdAt.toISOString(),
    mine: Boolean(userId) && row.authorId === userId,
  };
}

/** The borrower in the URL, checked against the caller's own scope - for writes */
async function borrowerScope(req: AuthenticatedRequest, res: Response): Promise<string | null> {
  const scope = scopeFor(req);
  if (!scope) { sendNoScope(res, false); return null; }
  return (await borrowerInScope(req, res, scope)) ? req.params.id as string : null;
}

/** The same check for a GET, where an admin may be viewing as someone */
async function borrowerReadScope(req: AuthenticatedRequest, res: Response): Promise<(ReadScope & { recordId: string }) | null> {
  const read = await readScope(req, res);
  if (!read) return null;
  return (await borrowerInScope(req, res, read.scope)) ? { ...read, recordId: req.params.id as string } : null;
}

async function borrowerInScope(req: AuthenticatedRequest, res: Response, scope: Scope): Promise<boolean> {
  const recordId = req.params.id as string;
  if (!isSfId(recordId) || !(await isRowInScope(scope, recordId))) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Borrower not found' } });
    return false;
  }
  return true;
}

router.get('/:id/notes', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const read = await borrowerReadScope(req, res);
    if (!read) return;
    const { recordId } = read;
    const rows = await getDb().select().from(notes)
      .where(eq(notes.sfRecordId, recordId)).orderBy(desc(notes.createdAt));
    res.json({ success: true, data: rows.map(r => toNote(r, req.userId)) });
  } catch (err) {
    console.error('Notes GET error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to load notes' } });
  }
});

router.post('/:id/notes', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (!body) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Write something first' } });
      return;
    }
    if (body.length > NOTE_MAX_LENGTH) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: `Notes are limited to ${NOTE_MAX_LENGTH} characters` } });
      return;
    }
    const recordId = await borrowerScope(req, res);
    if (!recordId) return;
    const [row] = await getDb().insert(notes).values({
      sfRecordId: recordId,
      authorId: req.userId ?? null,
      authorName: req.userName || 'Unknown',
      authorRole: req.userRole ?? 'agent',
      body,
    }).returning();
    res.json({ success: true, data: toNote(row, req.userId) });
  } catch (err) {
    console.error('Notes POST error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to save the note' } });
  }
});

// ── Realtor tasks (lendinggroupco-uhnx.11) ─────────────────────────────
// The fixed set Salesforce creates when a borrower is referred to a realtor. The realtor
// sees and completes her own; the LO and admins see them read-only. Every other Task on
// the borrower is the LP's and never leaves Salesforce.

function realtorOnly(req: AuthenticatedRequest, res: Response): string | null {
  if (req.userRole !== 'agent' || !isSfId(req.sfId)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the realtor can do this' } });
    return null;
  }
  return req.sfId;
}

router.get('/tasks/open', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.query.asUser !== undefined) {
      const read = await readScope(req, res);
      if (!read) return;
      if (read.scope.role !== 'agent') {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only realtors have a to do list' } });
        return;
      }
      res.json({ success: true, data: readOnly(await listOpenTasks(read.scope.contactId)) });
      return;
    }
    const contactId = realtorOnly(req, res);
    if (!contactId) return;
    res.json({ success: true, data: await listOpenTasks(contactId) });
  } catch (err) {
    console.error('Open tasks GET error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to load tasks' } });
  }
});

router.get('/:id/tasks', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const read = await borrowerReadScope(req, res);
    if (!read) return;
    const tasks = await listBorrowerTasks(read.scope, read.recordId);
    res.json({ success: true, data: read.viewingAs ? readOnly(tasks) : tasks });
  } catch (err) {
    console.error('Tasks GET error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to load tasks' } });
  }
});

// Takes no body on purpose: whatever the client sends is ignored, never forwarded
router.post('/:id/tasks/:taskId/complete', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const contactId = realtorOnly(req, res);
    if (!contactId) return;
    const recordId = await borrowerScope(req, res);
    if (!recordId) return;
    const taskId = req.params.taskId as string;
    const found = isSfId(taskId) ? await findTaskForRealtor(contactId, recordId, taskId) : null;
    if (!found) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }
    if (!found.IsClosed) {
      await completeTask(taskId);
      found.IsClosed = true;
      found.Status = 'Completed';
    }
    res.json({ success: true, data: mapTask(found, { role: 'agent', contactId }) });
  } catch (err) {
    console.error('Task complete error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Could not mark the task done' } });
  }
});

export default router;
