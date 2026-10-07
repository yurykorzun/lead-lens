import { Router, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { executeSoql, verifyContactScope } from '../services/salesforce/query.js';
import { isSfId } from '../services/validate.js';
import { getDb } from '../db/index.js';
import { auditLog } from '../db/schema.js';

const router = Router();

interface ActivityItem {
  type: 'sf_task' | 'audit';
  date: string;
  subject?: string;
  description?: string;
  status?: string;
  action?: string;
  changes?: Record<string, unknown>;
}

// Task bodies and field history carry internal notes. Agents never get them,
// a loan officer only for a record in their own scope. Returns the id, or null once it has answered.
async function allowedRecordId(req: AuthenticatedRequest, res: Response): Promise<string | null> {
  const forbidden = () => {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not available for this record' } });
    return null;
  };

  if (req.userRole !== 'admin' && req.userRole !== 'loan_officer') return forbidden();

  const id = req.params.id;
  if (!isSfId(id)) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Invalid record id' } });
    return null;
  }

  if (req.userRole === 'loan_officer') {
    if (!req.sfField || !req.sfValue) return forbidden();
    const inScope = await verifyContactScope([id], req.userRole, req.sfField, req.sfValue);
    if (!inScope.has(id)) return forbidden();
  }

  return id;
}

router.get('/:id/activity', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const contactId = await allowedRecordId(req, res);
    if (!contactId) return;

    // Query SF Tasks
    const sfQuery = `SELECT Id, Subject, ActivityDate, Status, Description, CreatedDate FROM Task WHERE WhoId = '${contactId}' ORDER BY CreatedDate DESC LIMIT 50`;

    const [sfResult, auditEntries] = await Promise.all([
      executeSoql(sfQuery).catch(() => ({ records: [] as Record<string, unknown>[] })),
      getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.sfRecordId, contactId)),
    ]);

    const activities: ActivityItem[] = [];

    // SF tasks
    for (const task of sfResult.records) {
      activities.push({
        type: 'sf_task',
        date: (task.CreatedDate || task.ActivityDate) as string,
        subject: task.Subject as string | undefined,
        description: task.Description as string | undefined,
        status: task.Status as string | undefined,
      });
    }

    // Audit log entries
    for (const entry of auditEntries) {
      activities.push({
        type: 'audit',
        date: entry.createdAt?.toISOString() || '',
        action: entry.action,
        changes: entry.afterJson as Record<string, unknown> | undefined,
      });
    }

    // Sort by date descending
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ success: true, data: activities });
  } catch (err) {
    console.error('Activity GET error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch activity' } });
  }
});

// GET /api/contacts/:id/history — SF ContactHistory (field change tracking)
router.get('/:id/history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const contactId = await allowedRecordId(req, res);
    if (!contactId) return;
    const soql = `SELECT Field, OldValue, NewValue, CreatedDate, CreatedBy.Name FROM ContactHistory WHERE ContactId = '${contactId}' ORDER BY CreatedDate DESC LIMIT 50`;

    const result = await executeSoql(soql).catch(() => ({ records: [] as Record<string, unknown>[] }));

    const history = result.records.map(r => {
      const createdBy = r.CreatedBy as Record<string, unknown> | undefined;
      return {
        field: r.Field as string,
        oldValue: r.OldValue as string | null,
        newValue: r.NewValue as string | null,
        date: r.CreatedDate as string,
        changedBy: createdBy?.Name as string | undefined,
      };
    });

    res.json({ success: true, data: history });
  } catch (err) {
    console.error('History GET error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch history' } });
  }
});

export default router;
