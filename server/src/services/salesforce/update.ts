import type { SFSaveResult } from '@lead-lens/shared';
import { getSalesforceToken } from './auth.js';

export async function bulkUpdate(
  sObjectType: string,
  records: Array<{ Id: string } & Record<string, unknown>>
): Promise<SFSaveResult[]> {
  const { accessToken, instanceUrl } = await getSalesforceToken();

  const response = await fetch(
    `${instanceUrl}/services/data/${process.env.SF_API_VERSION || 'v62.0'}/composite/sobjects`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ allOrNone: false, records: records.map(r => ({ attributes: { type: sObjectType }, ...r })) }),
    }
  );

  if (!response.ok) {
    throw new Error(`Bulk update failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<SFSaveResult[]>;
}
