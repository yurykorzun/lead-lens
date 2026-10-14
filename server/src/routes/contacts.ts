import { Router, type Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { NOTE_MAX_LENGTH, type ContactFilters, type ContactNote } from '@lead-lens/shared';
import { getDb } from '../db/index.js';
import { notes } from '../db/schema.js';
import { executeSoql, buildContactQuery, mapRow, isRowInScope, type Scope } from '../services/salesforce/query.js';
import { isIsoDate, isSfId } from '../services/validate.js';

// Read-only toward Salesforce. There is no Salesforce write: on lgc-ci a new Referred By on
// a lead, or a Task completed with an "update realtor" box ticked, texts the realtor, so
// nothing in Lead Lens may change a record. Notes are the one write, and they go to the
// Lead Lens database only.
const router = Router();

// null when the user has no Salesforce Id yet - they see nothing rather than everything
export function scopeFor(req: AuthenticatedRequest): Scope | null {
  if (req.userRole === 'admin') return { role: 'admin' };
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

async function noteScope(req: AuthenticatedRequest, res: Response): Promise<string | null> {
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
    const recordId = await noteScope(req, res);
    if (!recordId) return;
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
    const recordId = await noteScope(req, res);
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

export default router;
