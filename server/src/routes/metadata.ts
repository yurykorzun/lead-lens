import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { CLIENT_STATUS } from '@lead-lens/shared';
import { requireAuth } from '../middleware/auth.js';
import { describeObject, extractPicklistValues } from '../services/salesforce/metadata.js';
import { getDb } from '../db/index.js';
import { sfMetadataCache } from '../db/schema.js';

const router = Router();

// Dropdown key -> where its values live in lgc-ci
const PICKLISTS: Record<string, string[]> = {
  Lead: ['Status', 'Temperature__c', 'LeadSource'],
  Opportunity: ['StageName'],
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

type Options = Array<{ value: string; label: string }>;

async function picklistsFor(objectName: string, fields: string[]): Promise<Record<string, Options>> {
  const db = getDb();
  const cached = await db.select().from(sfMetadataCache).where(eq(sfMetadataCache.objectName, objectName));
  const isFresh = cached.length === fields.length && cached.every(r =>
    r.cachedAt && Date.now() - new Date(r.cachedAt).getTime() < CACHE_TTL_MS);
  if (isFresh) {
    return Object.fromEntries(cached.map(r => [r.fieldName, r.metadata as Options]));
  }

  const describe = await describeObject(objectName);
  const values = Object.fromEntries(fields.map(f => [f, extractPicklistValues(describe, f)]));

  for (const [fieldName, metadata] of Object.entries(values)) {
    await db
      .insert(sfMetadataCache)
      .values({ objectName, fieldName, metadata, cachedAt: new Date() })
      .onConflictDoUpdate({
        target: [sfMetadataCache.objectName, sfMetadataCache.fieldName],
        set: { metadata, cachedAt: new Date() },
      });
  }
  return values;
}

router.get('/dropdowns', requireAuth, async (_req, res) => {
  try {
    const dropdowns: Record<string, Options> = {};
    for (const [objectName, fields] of Object.entries(PICKLISTS)) {
      Object.assign(dropdowns, await picklistsFor(objectName, fields));
    }
    // A client row's status is not a Lead value, so the filter needs it added
    dropdowns.Status = [...(dropdowns.Status ?? []), { value: CLIENT_STATUS, label: CLIENT_STATUS }];

    res.json({ success: true, data: dropdowns });
  } catch (err) {
    console.error('Metadata GET error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch metadata' } });
  }
});

export default router;
