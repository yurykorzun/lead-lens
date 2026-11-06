/**
 * Salesforce access for the one-off scripts in this folder, and the guard that keeps them
 * on lgc-ci. The app's own env may point at another org (the old Jungo org, or a sandbox),
 * whose Ids mean nothing in lgc-ci, so every script refuses any other org unless told.
 *
 * Credentials, first that is set:
 *   SF_ACCESS_TOKEN + SF_INSTANCE_URL   (e.g. from `sf org display -o lgc-ci --json`)
 *   SF_LOGIN_URL + SF_CONSUMER_KEY + SF_CONSUMER_SECRET   (the app's client credentials)
 */
import { getSalesforceToken } from '../services/salesforce/auth.js';

export const LGC_CI_ORG_ID = '00Da500001SpYbJEAV';
// The Lead_Lens integration user cannot read Organization (read-only permission set,
// on purpose), so the guard falls back to the instance the token was issued for.
export const LGC_CI_HOST = 'flow-enterprise-8486.my.salesforce.com';

export async function sfConnection(): Promise<{ accessToken: string; instanceUrl: string }> {
  if (process.env.SF_ACCESS_TOKEN && process.env.SF_INSTANCE_URL) {
    return { accessToken: process.env.SF_ACCESS_TOKEN, instanceUrl: process.env.SF_INSTANCE_URL };
  }
  return getSalesforceToken();
}

function apiBase() {
  return `/services/data/${process.env.SF_API_VERSION || 'v62.0'}`;
}

/** Every record of a SOQL query, following nextRecordsUrl */
export async function query<T>(soql: string): Promise<T[]> {
  const { accessToken, instanceUrl } = await sfConnection();
  const out: T[] = [];
  let next: string | null = `${apiBase()}/query?q=${encodeURIComponent(soql)}`;
  while (next) {
    const res = await fetch(`${instanceUrl}${next}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`SOQL failed: ${res.status} ${await res.text()}`);
    const body = await res.json() as { records: T[]; nextRecordsUrl?: string };
    out.push(...body.records);
    next = body.nextRecordsUrl ?? null;
  }
  return out;
}

/** Inserts one record and returns its Id */
export async function insert(sobject: string, record: Record<string, unknown>): Promise<string> {
  const { accessToken, instanceUrl } = await sfConnection();
  const res = await fetch(`${instanceUrl}${apiBase()}/sobjects/${sobject}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`${sobject} insert failed: ${res.status} ${await res.text()}`);
  const created = await res.json() as { id?: string; success?: boolean };
  if (!created.success || !created.id) throw new Error(`${sobject} insert returned no Id`);
  return created.id;
}

export async function isLgcCi(): Promise<boolean> {
  try {
    const [org] = await query<{ Id: string; Name: string }>('SELECT Id, Name FROM Organization');
    console.log(`Salesforce org: ${org.Name} ${org.Id}`);
    return org.Id.startsWith(LGC_CI_ORG_ID);
  } catch {
    const { instanceUrl } = await sfConnection();
    const host = new URL(instanceUrl).host;
    console.log(`Salesforce instance: ${host} (Organization not readable by this user)`);
    return host === LGC_CI_HOST;
  }
}

/** Throws unless the credentials point at lgc-ci, or anyOrg is set */
export async function requireLgcCi(anyOrg: boolean) {
  if (!(await isLgcCi()) && !anyOrg) {
    throw new Error(`This is not lgc-ci (${LGC_CI_ORG_ID}). Set SF_ACCESS_TOKEN/SF_INSTANCE_URL for lgc-ci, or pass --any-org.`);
  }
}

export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
