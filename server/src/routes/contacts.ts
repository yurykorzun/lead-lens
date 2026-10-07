import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import type { ContactFilters } from '@lead-lens/shared';
import { executeSoql, buildContactQuery, mapRow, type Scope } from '../services/salesforce/query.js';
import { isIsoDate, isSfId } from '../services/validate.js';

// Read-only. There is no write route: on lgc-ci a Status change fires referral texts to
// realtors, so nothing in Lead Lens may change a record.
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

export default router;
