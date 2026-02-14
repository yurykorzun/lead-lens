import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import type { ContactFilters, BulkUpdatePayload, ContactRow } from '@lead-lens/shared';
import { FIELD_MAP, REVERSE_FIELD_MAP } from '@lead-lens/shared';
import { executeSoql, buildContactQuery } from '../services/salesforce/query.js';
import { bulkUpdate } from '../services/salesforce/update.js';
import { writeAuditLog } from '../services/audit.js';

const router = Router();

// Map a SF record to a ContactRow
function mapSfToContact(record: Record<string, unknown>): ContactRow {
  const owner = record.Owner as Record<string, unknown> | undefined;

  return {
    id: record.Id as string,
    name: record.Name as string,
    firstName: record.FirstName as string | undefined,
    lastName: record.LastName as string | undefined,
    email: record.Email as string | undefined,
    phone: record.Phone as string | undefined,
    mobilePhone: record.MobilePhone as string | undefined,
    status: record.Status__c as string | undefined,
    temperature: record.Temparture__c as string | undefined,
    noOfCalls: record.No_of_Calls__c as number | undefined,
    message: record.Message_QuickUpdate__c as string | undefined,
    hotLead: record.Hot_Lead__c as boolean | undefined,
    paal: record.PAAL__c as boolean | undefined,
    inProcess: record.In_Process__c as boolean | undefined,
    stage: record.MtgPlanner_CRM__Stage__c as string | undefined,
    thankYouToReferralSource: record.MtgPlanner_CRM__Thank_you_to_Referral_Source__c as boolean | undefined,
    bdr: record.BDR__c as string | undefined,
    loanPartner: record.Loan_Partners__c as string | undefined,
    leonLoanPartner: record.Leon_Loan_Partner__c as string | undefined,
    maratLoanPartner: record.Marat__c as string | undefined,
    leonBdr: record.Leon_BDR__c as string | undefined,
    maratBdr: record.Marat_BDR__c as string | undefined,
    leadSource: record.LeadSource as string | undefined,
    isClient: record.Is_Client__c as boolean | undefined,
    ownerId: record.OwnerId as string | undefined,
    ownerName: owner?.Name as string | undefined,
    recordType: record.RecordTypeId as string | undefined,
    createdDate: record.CreatedDate as string | undefined,
    lastModifiedDate: record.LastModifiedDate as string | undefined,
  };
}

router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.sfField || !req.sfValue) {
      res.status(403).json({ success: false, error: { code: 'NO_SCOPE', message: 'User has no Salesforce scope configured' } });
      return;
    }

    const filters = req.query as unknown as ContactFilters;

    const { dataQuery, countQuery } = buildContactQuery({
      sfField: req.sfField,
      sfValue: req.sfValue,
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

    const contacts = dataResult.records.map(mapSfToContact);
    const totalCount = countResult.totalSize;
    const page = filters.page ? Number(filters.page) : 1;
    const pageSize = filters.pageSize ? Math.min(Number(filters.pageSize), 200) : 50;

    res.json({
      success: true,
      data: contacts,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (err) {
    console.error('Contacts GET error:', err);
    const errMsg = err instanceof Error ? err.message : 'Failed to fetch contacts';
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: errMsg } });
  }
});

// Editable fields for loan_officer role
const PARTNER_EDITABLE_FIELDS = new Set([
  'status', 'temperature', 'noOfCalls', 'message', 'hotLead',
  'paal', 'inProcess', 'stage', 'thankYouToReferralSource',
]);

router.patch('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { updates } = req.body as BulkUpdatePayload;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Updates array is required' } });
      return;
    }

    if (updates.length > 200) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Max 200 records per request' } });
      return;
    }

    // Map camelCase fields to SF API names, validating against allowlist
    const sfRecords = updates.map(({ id, fields }) => {
      const sfFields: { Id: string } & Record<string, unknown> = { Id: id };

      for (const [key, value] of Object.entries(fields)) {
        // Validate field is in FIELD_MAP
        const sfName = (FIELD_MAP as Record<string, string>)[key];
        if (!sfName) {
          throw new Error(`Unknown field: ${key}`);
        }

        // Check role-based permissions
        if (req.userRole === 'loan_officer' && !PARTNER_EDITABLE_FIELDS.has(key)) {
          throw new Error(`Field not editable: ${key}`);
        }

        sfFields[sfName] = value;
      }

      return sfFields;
    });

    const results = await bulkUpdate('Contact', sfRecords);

    // Write audit logs for successful updates
    for (let i = 0; i < results.length; i++) {
      if (results[i].success) {
        await writeAuditLog({
          userId: req.userId!,
          sfRecordId: updates[i].id,
          action: 'update',
          afterJson: updates[i].fields,
          ip: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
        });
      }
    }

    res.json({
      success: true,
      data: results.map((r, i) => ({
        id: updates[i].id,
        success: r.success,
        error: r.errors?.length ? r.errors[0].message : undefined,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update contacts';
    console.error('Contacts PATCH error:', err);
    res.status(400).json({ success: false, error: { code: 'UPDATE_FAILED', message } });
  }
});

export default router;
