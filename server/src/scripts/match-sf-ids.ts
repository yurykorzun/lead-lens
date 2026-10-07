/**
 * Propose lgc-ci Salesforce Ids for every Lead Lens agent and loan officer.
 *
 *   agent         -> realtor Contact with that exact Name (users.sf_contact_id)
 *   loan officer  -> active User with that exact Name   (users.sf_user_id)
 *
 * Read-only against Salesforce. Writes to Postgres only with --apply, and only
 * unique matches; NO MATCH and AMBIGUOUS rows are left for a person to decide.
 *
 * Salesforce credentials, first that is set:
 *   SF_ACCESS_TOKEN + SF_INSTANCE_URL   (e.g. from `sf org display -o lgc-ci --json`)
 *   SF_LOGIN_URL + SF_CONSUMER_KEY + SF_CONSUMER_SECRET   (the app's client credentials)
 *
 * Users come from DATABASE_URL, or skip Postgres entirely for a spot check:
 *   npx tsx server/src/scripts/match-sf-ids.ts --role agent --name "Jane Doe" --name "John Roe"
 *
 * Usage:
 *   npx tsx server/src/scripts/match-sf-ids.ts            # report only
 *   npx tsx server/src/scripts/match-sf-ids.ts --apply    # also write unique matches
 *   add --overwrite to replace Ids that are already set
 *   it refuses any org but lgc-ci unless --any-org is passed
 */
import 'dotenv/config';
import { and, eq, inArray } from 'drizzle-orm';
import { getSalesforceToken } from '../services/salesforce/auth.js';
import {
  type ContactCandidate, type MatchResult, type MatchRole, type UserCandidate,
  classifyAgent, classifyLoanOfficer, escapeSoqlString, formatResultLine, normalizeName,
} from '../services/sf-id-match.js';

// lgc-ci production. The app's own env may still point at the old Jungo org,
// whose Ids mean nothing in lgc-ci, so refuse any other org unless told.
const LGC_CI_ORG_ID = '00Da500001SpYbJEAV';

interface Target { id: string | null; role: MatchRole; name: string; current: string | null }

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const overwrite = args.includes('--overwrite');
const cliNames = args.flatMap((a, i) => (a === '--name' ? [args[i + 1]] : [])).filter(Boolean);
const anyOrg = args.includes('--any-org');
const cliRole = (args[args.indexOf('--role') + 1] ?? 'agent') as MatchRole;

async function sfConnection(): Promise<{ accessToken: string; instanceUrl: string }> {
  if (process.env.SF_ACCESS_TOKEN && process.env.SF_INSTANCE_URL) {
    return { accessToken: process.env.SF_ACCESS_TOKEN, instanceUrl: process.env.SF_INSTANCE_URL };
  }
  return getSalesforceToken();
}

async function query<T>(soql: string): Promise<T[]> {
  const { accessToken, instanceUrl } = await sfConnection();
  const version = process.env.SF_API_VERSION || 'v62.0';
  const out: T[] = [];
  let next: string | null = `/services/data/${version}/query?q=${encodeURIComponent(soql)}`;
  while (next) {
    const res = await fetch(`${instanceUrl}${next}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`SOQL failed: ${res.status} ${await res.text()}`);
    const body = await res.json() as { records: T[]; nextRecordsUrl?: string };
    out.push(...body.records);
    next = body.nextRecordsUrl ?? null;
  }
  return out;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function contactCandidates(names: string[]): Promise<Map<string, ContactCandidate[]>> {
  const byName = new Map<string, ContactCandidate[]>();
  const all: ContactCandidate[] = [];
  for (const batch of chunks(names, 100)) {
    const list = batch.map(n => `'${escapeSoqlString(n.trim())}'`).join(',');
    const rows = await query<{ Id: string; Name: string; Account: { Name: string; RecordType: { DeveloperName: string } | null } | null }>(
      `SELECT Id, Name, Account.Name, Account.RecordType.DeveloperName FROM Contact WHERE Name IN (${list})`,
    );
    for (const r of rows) {
      all.push({ Id: r.Id, Name: r.Name, accountName: r.Account?.Name ?? null, recordType: r.Account?.RecordType?.DeveloperName ?? null, referrals: 0 });
    }
  }
  // Referral counts help a person pick between namesakes
  for (const batch of chunks(all.map(c => c.Id), 200)) {
    const ids = batch.map(id => `'${id}'`).join(',');
    const counts = await query<{ Referred_By__c: string; n: number }>(
      `SELECT Referred_By__c, COUNT(Id) n FROM Lead WHERE Referred_By__c IN (${ids}) GROUP BY Referred_By__c`,
    );
    const map = new Map(counts.map(c => [c.Referred_By__c, c.n]));
    for (const c of all) if (map.has(c.Id)) c.referrals = map.get(c.Id)!;
  }
  for (const c of all) {
    const key = normalizeName(c.Name);
    byName.set(key, [...(byName.get(key) ?? []), c]);
  }
  return byName;
}

async function userCandidates(names: string[]): Promise<Map<string, UserCandidate[]>> {
  const byName = new Map<string, UserCandidate[]>();
  for (const batch of chunks(names, 100)) {
    const list = batch.map(n => `'${escapeSoqlString(n.trim())}'`).join(',');
    const rows = await query<UserCandidate>(`SELECT Id, Name, IsActive FROM User WHERE Name IN (${list})`);
    for (const r of rows) {
      const key = normalizeName(r.Name);
      byName.set(key, [...(byName.get(key) ?? []), r]);
    }
  }
  return byName;
}

async function loadTargets(): Promise<Target[]> {
  if (cliNames.length > 0) {
    return cliNames.map(name => ({ id: null, role: cliRole, name, current: null }));
  }
  const { getDb } = await import('../db/index.js');
  const { users } = await import('../db/schema.js');
  const rows = await getDb()
    .select({ id: users.id, role: users.role, name: users.name, sfContactId: users.sfContactId, sfUserId: users.sfUserId })
    .from(users)
    .where(inArray(users.role, ['agent', 'loan_officer']));
  return rows
    .filter(r => r.name)
    .map(r => ({
      id: r.id,
      role: r.role as MatchRole,
      name: r.name!,
      current: r.role === 'agent' ? r.sfContactId : r.sfUserId,
    }));
}

async function main() {
  if (apply && cliNames.length > 0) throw new Error('--apply works only on users loaded from the database');
  const [org] = await query<{ Id: string; Name: string }>('SELECT Id, Name FROM Organization');
  console.log(`Salesforce org: ${org.Name} ${org.Id}`);
  if (!org.Id.startsWith(LGC_CI_ORG_ID) && !anyOrg) {
    throw new Error(`This is not lgc-ci (${LGC_CI_ORG_ID}). Set SF_ACCESS_TOKEN/SF_INSTANCE_URL for lgc-ci, or pass --any-org.`);
  }
  const targets = await loadTargets();
  const agents = targets.filter(t => t.role === 'agent');
  const los = targets.filter(t => t.role === 'loan_officer');

  const contacts = agents.length ? await contactCandidates(agents.map(t => t.name)) : new Map();
  const sfUsers = los.length ? await userCandidates(los.map(t => t.name)) : new Map();

  const results: Array<{ target: Target; result: MatchResult }> = [];
  for (const t of [...agents, ...los]) {
    const key = normalizeName(t.name);
    const result = t.role === 'agent' ? classifyAgent(contacts.get(key) ?? []) : classifyLoanOfficer(sfUsers.get(key) ?? []);
    results.push({ target: t, result });
    console.log(formatResultLine(t.role, t.name, t.current, result));
  }

  const tally = (kind: MatchResult['kind']) => results.filter(r => r.result.kind === kind).length;
  console.log(`\n${results.length} users: ${tally('match')} matched, ${tally('none')} NO MATCH, ${tally('ambiguous')} AMBIGUOUS`);

  if (!apply) {
    console.log('Report only. Nothing was written. Re-run with --apply to save the unique matches.');
    return;
  }

  const { getDb } = await import('../db/index.js');
  const { users } = await import('../db/schema.js');
  const db = getDb();
  let written = 0;
  let skipped = 0;
  for (const { target, result } of results) {
    if (result.kind !== 'match' || !target.id) continue;
    if (target.current === result.id) continue;
    if (target.current && !overwrite) { skipped++; continue; }
    const set = target.role === 'agent' ? { sfContactId: result.id } : { sfUserId: result.id };
    await db.update(users).set(set).where(and(eq(users.id, target.id), eq(users.role, target.role)));
    written++;
  }
  console.log(`Wrote ${written} Ids.${skipped ? ` Kept ${skipped} existing Ids that differ (use --overwrite to replace).` : ''}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
