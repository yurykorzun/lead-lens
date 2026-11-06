import { Router, type Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { NOTE_MAX_LENGTH, type ContactFilters, type ContactNote } from '@lead-lens/shared';
import { executeSoql, buildContactQuery, mapRow, isRowInScope, rowIdsInScope, type Scope } from '../services/salesforce/query.js';
import { listRealtorNotes, createRealtorNote } from '../services/salesforce/realtor-notes.js';
import { isIsoDate, isSfId } from '../services/validate.js';
import { listBorrowerTasks, listOpenTasks, findTaskForRealtor, completeTask, mapTask } from '../services/salesforce/tasks.js';

// Read-only toward Salesforce, with TWO exceptions. On lgc-ci a new Referred By on a lead,
// or a Task completed with an "update realtor" box ticked, texts the realtor, so Lead Lens
// changes no existing record except this: the realtor marks one of her own realtor tasks
// Completed (services/salesforce/tasks.ts - a constant body, Status only). The other write
// is an insert: a new Realtor_Note__c (services/salesforce/realtor-notes.ts - an allowlisted
// body built field by field).
const router = Router();

// An admin can look at Lead Lens as one loan officer or realtor sees it (Officer View /
// Agent View, lendinggroupco-uhnx.7): ?viewAs=agent:<Contact Id> or loan_officer:<User Id>.
// It only narrows what an admin already sees, so it needs no lookup; anyone else's viewAs
// is ignored. A malformed value is ignored too, which shows the admin every row.
export function viewAsScope(req: AuthenticatedRequest): Scope | null {
  if (req.userRole !== 'admin') return null;
  const raw = req.query?.viewAs;
  if (typeof raw !== 'string') return null;
  const [role, id] = raw.split(':');
  if (!isSfId(id)) return null;
  if (role === 'agent') return { role: 'agent', contactId: id };
  if (role === 'loan_officer') return { role: 'loan_officer', userId: id };
  return null;
}

// null when the user has no Salesforce Id yet - they see nothing rather than everything
export function scopeFor(req: AuthenticatedRequest): Scope | null {
  if (req.userRole === 'admin') return viewAsScope(req) ?? { role: 'admin' };
  if (!isSfId(req.sfId)) return null;
  if (req.userRole === 'agent') return { role: 'agent', contactId: req.sfId };
  if (req.userRole === 'loan_officer') return { role: 'loan_officer', userId: req.sfId };
  return null;
}

router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const scope = scopeFor(req);
    if (!scope) {
      res.status(403).json({ success: false, error: { code: 'NO_SCOPE', message: 'Your account is not linked to Salesforce yet. Contact your admin.' } });
      return;
    }

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
// Realtor notes live on Realtor_Note__c in lgc-ci (lendinggroupco-uhnx.12), so the LO sees
// them in Salesforce and the realtor sees the LO's "Note to Realtor" here. Everyone who can
// see a borrower on their dashboard can read and add its notes: the realtor, the loan
// officer who owns it, and admins. Checked against Salesforce on every call, so a realtor
// whose referral moves elsewhere loses access.
//
// The notes written before the move (the old Lead Lens `notes` table) were copied to
// Realtor_Note__c on 2026-11-06 (lendinggroupco-uhnx.12.4), so nothing reads that table now.

function reader(req: AuthenticatedRequest) {
  return { name: req.userName || 'Unknown', role: req.userRole ?? 'agent' };
}

async function borrowerScope(req: AuthenticatedRequest, res: Response): Promise<string | null> {
  const recordId = req.params.id as string;
  const scope = scopeFor(req);
  if (!scope) {
    res.status(403).json({ success: false, error: { code: 'NO_SCOPE', message: 'Your account is not linked to Salesforce yet. Contact your admin.' } });
    return null;
  }
  if (!isSfId(recordId) || !(await isRowInScope(scope, recordId))) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Borrower not found' } });
    return null;
  }
  return recordId;
}

router.get('/:id/notes', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const recordId = await borrowerScope(req, res);
    if (!recordId) return;
    const ids = await rowIdsInScope(scopeFor(req)!, recordId);
    res.json({ success: true, data: await listRealtorNotes(ids) });
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
    // Viewing as someone else is read-only, so a note never lands under the wrong name
    if (viewAsScope(req)) {
      res.status(403).json({ success: false, error: { code: 'VIEW_ONLY', message: 'Notes cannot be added while viewing as someone else' } });
      return;
    }
    const recordId = await borrowerScope(req, res);
    if (!recordId) return;
    // Only the trimmed text and the caller's own name and role reach the insert
    const author = reader(req);
    // A client row is a person account (the borrower filter), and its page lists notes by
    // Account Id - so the note carries the row's one Account too. Taken from Salesforce,
    // never from the request.
    let personAccountId: string | undefined;
    if (recordId.startsWith('003')) {
      const { accountIds } = await rowIdsInScope(scopeFor(req)!, recordId);
      if (accountIds.length === 1) personAccountId = accountIds[0];
    }
    const id = await createRealtorNote(recordId, body, author, personAccountId);
    const note: ContactNote = {
      id,
      body,
      authorName: author.name,
      authorRole: author.role as ContactNote['authorRole'],
      source: 'Lead Lens',
      createdAt: new Date().toISOString(),
      mine: true,
    };
    res.json({ success: true, data: note });
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
    const recordId = await borrowerScope(req, res);
    if (!recordId) return;
    const tasks = await listBorrowerTasks(scopeFor(req)!, recordId);
    // An admin viewing as a realtor sees her steps but cannot tick them
    if (viewAsScope(req)) for (const t of tasks) t.canComplete = false;
    res.json({ success: true, data: tasks });
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
