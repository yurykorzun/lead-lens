import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { describeObject, extractPicklistValues } from '../services/salesforce/metadata.js';
import { getDb } from '../db/index.js';
import { sfMetadataCache } from '../db/schema.js';

const router = Router();

const PICKLIST_FIELDS = [
  'Status__c',
  'Temparture__c',
  'No_of_Calls__c',
  'MtgPlanner_CRM__Stage__c',
  'BDR__c',
  'Leon_BDR__c',
  'Marat_BDR__c',
  'Loan_Partners__c',
  'Leon_Loan_Partner__c',
  'Marat__c',
  'LeadSource',
];

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

router.get('/dropdowns', requireAuth, async (_req, res) => {
  try {
    const db = getDb();

    // Check cache
    const cached = await db
      .select()
      .from(sfMetadataCache)
      .where(eq(sfMetadataCache.objectName, 'Contact'));

    const now = Date.now();
    const isFresh = cached.length > 0 && cached[0].cachedAt &&
      now - new Date(cached[0].cachedAt).getTime() < CACHE_TTL_MS;

    if (isFresh && cached.length === PICKLIST_FIELDS.length) {
      // Return from cache
      const dropdowns: Record<string, Array<{ value: string; label: string }>> = {};
      for (const row of cached) {
        dropdowns[row.fieldName] = row.metadata as Array<{ value: string; label: string }>;
      }
      res.json({ success: true, data: dropdowns });
      return;
    }

    // Fetch fresh from SF
    const describe = await describeObject('Contact');

    const dropdowns: Record<string, Array<{ value: string; label: string }>> = {};
    for (const fieldName of PICKLIST_FIELDS) {
      dropdowns[fieldName] = extractPicklistValues(describe, fieldName);
    }

    // Upsert cache
    for (const [fieldName, values] of Object.entries(dropdowns)) {
      await db
        .insert(sfMetadataCache)
        .values({
          objectName: 'Contact',
          fieldName,
          metadata: values,
          cachedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [sfMetadataCache.objectName, sfMetadataCache.fieldName],
          set: { metadata: values, cachedAt: new Date() },
        });
    }

    res.json({ success: true, data: dropdowns });
  } catch (err) {
    console.error('Metadata GET error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch metadata' } });
  }
});

export default router;
