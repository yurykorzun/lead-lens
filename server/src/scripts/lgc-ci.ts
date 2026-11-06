/**
 * Salesforce access for the one-off scripts in this folder, and the guard that keeps them
 * on lgc-ci. The app's own env may point at another org (the old Jungo org, or a sandbox),
 * whose Ids mean nothing in lgc-ci, so every script refuses any other org unless told.
 *
 * Credentials, first that is set:
 *   SF_CLI_ORG=lgc-ci   (the sf CLI's own login, e.g. an admin's - no secrets needed, because
 *                        newer sf versions hide the access token from `sf org display`)
 *   SF_ACCESS_TOKEN + SF_INSTANCE_URL
 *   SF_LOGIN_URL + SF_CONSUMER_KEY + SF_CONSUMER_SECRET   (the app's client credentials)
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

/** One REST call: through the sf CLI when SF_CLI_ORG is set, else with a bearer token */
async function rest(path: string, body?: Record<string, unknown>): Promise<unknown> {
  const cliOrg = process.env.SF_CLI_ORG;
  if (cliOrg) {
    const args = ['api', 'request', 'rest', path, '-o', cliOrg];
    let dir: string | undefined;
    if (body) {
      // The body goes in a temp file, never on the command line (it can hold note text)
      dir = mkdtempSync(join(tmpdir(), 'lgc-ci-'));
      const file = join(dir, 'body.json');
      writeFileSync(file, JSON.stringify(body));
      args.push('-X', 'POST', '-H', 'Content-Type: application/json', '-b', `@${file}`);
    }
    try {
      // Without the app's .env: the sf CLI reads SF_* variables as its own settings (SF_LOGIN_URL
      // sends it to another org), and NODE_ENV makes it look for dev-only plugins and fail
      const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('SF_') && k !== 'NODE_ENV'));
      let out: string;
      try {
        out = execFileSync('sf', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env });
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string };
        const detail = `${e.stdout ?? ''} ${e.stderr ?? ''}`.replace(/.*update available.*\n?/g, '').trim();
        throw new Error(`${path} failed: ${detail}`);
      }
      const parsed = JSON.parse(out) as unknown;
      if (Array.isArray(parsed) && (parsed[0] as { errorCode?: string })?.errorCode) {
        throw new Error(`${path} failed: ${out}`);
      }
      return parsed;
    } finally {
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  }
  const { accessToken, instanceUrl } = await sfConnection();
  const res = await fetch(`${instanceUrl}${path}`, body
    ? { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Every record of a SOQL query, following nextRecordsUrl */
export async function query<T>(soql: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = `${apiBase()}/query?q=${encodeURIComponent(soql)}`;
  while (next) {
    const body = await rest(next) as { records: T[]; nextRecordsUrl?: string };
    out.push(...body.records);
    next = body.nextRecordsUrl ?? null;
  }
  return out;
}

/** Inserts one record and returns its Id */
export async function insert(sobject: string, record: Record<string, unknown>): Promise<string> {
  const created = await rest(`${apiBase()}/sobjects/${sobject}`, record) as { id?: string; success?: boolean };
  if (!created.success || !created.id) throw new Error(`${sobject} insert returned no Id`);
  return created.id;
}

export async function isLgcCi(): Promise<boolean> {
  try {
    const [org] = await query<{ Id: string; Name: string }>('SELECT Id, Name FROM Organization');
    console.log(`Salesforce org: ${org.Name} ${org.Id}`);
    return org.Id.startsWith(LGC_CI_ORG_ID);
  } catch {
    if (process.env.SF_CLI_ORG) return false;
    const { instanceUrl } = await sfConnection();
    const host = new URL(instanceUrl).host;
    console.log(`Salesforce instance: ${host} (Organization not readable by this user)`);
    return host === LGC_CI_HOST;
  }
}

/** Throws unless the credentials point at lgc-ci, or anyOrg is set */
export async function requireLgcCi(anyOrg: boolean) {
  if (!(await isLgcCi()) && !anyOrg) {
    throw new Error(`This is not lgc-ci (${LGC_CI_ORG_ID}). Set SF_CLI_ORG=lgc-ci or SF_ACCESS_TOKEN/SF_INSTANCE_URL for lgc-ci, or pass --any-org.`);
  }
}

export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
