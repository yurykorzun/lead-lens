import { getDb } from '../db/index.js';
import { auditLog } from '../db/schema.js';

interface AuditEntry {
  userId: string;
  sfRecordId: string;
  action: string;
  beforeJson?: Record<string, unknown>;
  afterJson?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const db = getDb();
  await db.insert(auditLog).values({
    userId: entry.userId,
    sfRecordId: entry.sfRecordId,
    action: entry.action,
    beforeJson: entry.beforeJson,
    afterJson: entry.afterJson,
    ip: entry.ip,
    userAgent: entry.userAgent,
  });
}
