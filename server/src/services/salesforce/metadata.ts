import type { SFDescribeResult } from '@lead-lens/shared';
import { getSalesforceToken } from './auth.js';

export async function describeObject(sObjectType: string): Promise<SFDescribeResult> {
  const { accessToken, instanceUrl } = await getSalesforceToken();

  const response = await fetch(
    `${instanceUrl}/services/data/${process.env.SF_API_VERSION || 'v62.0'}/sobjects/${sObjectType}/describe`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Describe failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<SFDescribeResult>;
}

export function extractPicklistValues(
  describe: SFDescribeResult,
  fieldName: string
): Array<{ value: string; label: string }> {
  const field = describe.fields.find(f => f.name === fieldName);
  if (!field?.picklistValues) return [];
  return field.picklistValues
    .filter(p => p.active)
    .map(p => ({ value: p.value, label: p.label }));
}
