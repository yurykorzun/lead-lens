import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { executeSoql } from '../services/salesforce/query.js';
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

router.get('/:id/activity', requireAuth, async (req, res) => {
  try {
    const contactId = req.params.id;

    // Query SF Tasks
    const sfQuery = `SELECT Id, Subject, ActivityDate, Status, Description, CreatedDate FROM Task WHERE WhoId = '${contactId}' ORDER BY CreatedDate DESC LIMIT 50`;

    const [sfResult, auditEntries] = await Promise.all([
      executeSoql(sfQuery).catch(() => ({ records: [] as Record<string, unknown>[] })),
      getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.sfRecordId, contactId as string)),
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
router.get('/:id/history', requireAuth, async (req, res) => {
  try {
    const contactId = req.params.id;
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
