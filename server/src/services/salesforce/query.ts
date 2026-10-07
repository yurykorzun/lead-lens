import { CLIENT_STATUS, type ContactRow, type SFQueryResponse } from '@lead-lens/shared';
import { getSalesforceToken } from './auth.js';
import { mockExecuteSoql } from './mock.js';
import { isIsoDate, isSfId } from '../validate.js';

// Rows come from LeadAccount__c, the lgc-ci Originator Tracker mirror: one row per Lead
// and per Contact, so Leads and clients page together and the counts match the tracker.
//
// NO LONG TEXT FIELDS (Rep_Notes__c, Message_to_Realtor__c, Description). They are
// internal notes and never leave the org - and on this object they also make Salesforce
// return short pages (lendinggroupco-1qs1).
const ROW_FIELDS = [
  'Id', 'Lead__c', 'Contact__c', 'First_Name__c', 'Last_Name__c', 'Phone__c',
  'Status__c', 'Temperature__c', 'Lead_Source__c', 'Created_Date__c',
  'Referred_By_First_Name__c', 'Referred_By_Last_Name__c',
  'Lead__r.Email', 'Lead__r.Owner.Name', 'Contact__r.Email', 'Contact__r.Owner.Name',
  'Opportunity__r.StageName',
].join(', ');

// Borrowers only: the tracker's allowlist minus realtors and business contacts.
// DeveloperNames, because a label can be renamed in Setup.
const BORROWER_ROWS =
  "((Lead__c != null AND Lead__r.RecordType.DeveloperName = 'Borrower')" +
  " OR (Contact__c != null AND Contact__r.Account.RecordType.DeveloperName = 'PersonAccount'))";

// SOQL OFFSET cannot go past 2000
const MAX_OFFSET = 2000;

export type Scope =
  | { role: 'admin' }
  | { role: 'agent'; contactId: string }
  | { role: 'loan_officer'; userId: string };

export async function executeSoql<T = Record<string, unknown>>(
  soql: string
): Promise<SFQueryResponse<T>> {
  if (process.env.MOCK_SALESFORCE === 'true') return mockExecuteSoql(soql);

  const { accessToken, instanceUrl } = await getSalesforceToken();

  const response = await fetch(
    `${instanceUrl}/services/data/${process.env.SF_API_VERSION || 'v62.0'}/query?q=${encodeURIComponent(soql)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`SOQL query failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<SFQueryResponse<T>>;
}

function escapeSOQL(value: string): string {
  // Backslash first, or a trailing \ would swallow the escape added for the quote
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// The REST query endpoint has no bind variables, so an Id is checked against the
// Salesforce Id shape and only then quoted in - nothing else can reach the WHERE clause.
function quoteId(id: string): string {
  if (!isSfId(id)) throw new Error('Invalid Salesforce Id');
  return `'${id}'`;
}

/**
 * The rows a user may see. Ids only, never names - two realtors can share a name.
 * Uses the real lookups, not LeadAccount__c.Referred_By__c: that formula holds the
 * 15-character Id, so comparing it with an 18-character Id silently matches nothing.
 */
export function scopeCondition(scope: Scope): string | null {
  if (scope.role === 'admin') return null;
  if (scope.role === 'agent') {
    const id = quoteId(scope.contactId);
    return `(Lead__r.Referred_By__c = ${id} OR Contact__r.Referred_By__c = ${id} OR Opportunity__r.Referring_Agent__c = ${id})`;
  }
  if (scope.role === 'loan_officer') {
    const id = quoteId(scope.userId);
    return `(Lead__r.OwnerId = ${id} OR Contact__r.OwnerId = ${id} OR Opportunity__r.OwnerId = ${id})`;
  }
  throw new Error('Unknown role');
}

export interface RowQueryParams {
  search?: string;
  status?: string;
  temperature?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

function whereClause(scope: Scope, params: RowQueryParams): string {
  const { search, status, temperature, dateFrom, dateTo } = params;
  if ((dateFrom && !isIsoDate(dateFrom)) || (dateTo && !isIsoDate(dateTo))) {
    throw new Error('Dates must be YYYY-MM-DD');
  }

  const conditions = [BORROWER_ROWS];
  const scoped = scopeCondition(scope);
  if (scoped) conditions.push(scoped);

  if (status === CLIENT_STATUS) {
    conditions.push('Lead__c = null');
  } else if (status) {
    // On a client row Status__c is the loan stage, so a lead status only matches leads
    conditions.push(`Lead__c != null AND Status__c = '${escapeSOQL(status)}'`);
  }
  if (temperature) {
    conditions.push(`Temperature__c = '${escapeSOQL(temperature)}'`);
  }
  if (search) {
    const s = escapeSOQL(search);
    conditions.push(`(First_Name__c LIKE '%${s}%' OR Last_Name__c LIKE '%${s}%')`);
  }
  // Created_Date__c is a Date, the same one the tracker filters and shows
  if (dateFrom) conditions.push(`Created_Date__c >= ${dateFrom}`);
  if (dateTo) conditions.push(`Created_Date__c <= ${dateTo}`);

  return `WHERE ${conditions.join(' AND ')}`;
}

export function buildContactQuery(scope: Scope, params: RowQueryParams): { dataQuery: string; countQuery: string; page: number; pageSize: number; maxPage: number } {
  const pageSize = Math.min(Math.max(params.pageSize || 50, 1), 200);
  const maxPage = Math.floor(MAX_OFFSET / pageSize) + 1;
  const page = Math.min(Math.max(params.page || 1, 1), maxPage);
  const offset = (page - 1) * pageSize;
  const where = whereClause(scope, params);

  // Id breaks ties so paging is stable across requests
  const dataQuery = `SELECT ${ROW_FIELDS} FROM LeadAccount__c ${where} ORDER BY Created_Date__c DESC NULLS LAST, Id DESC LIMIT ${pageSize} OFFSET ${offset}`;
  const countQuery = `SELECT COUNT() FROM LeadAccount__c ${where}`;

  return { dataQuery, countQuery, page, pageSize, maxPage };
}

type Rel = { Email?: string; Owner?: { Name?: string } } | null | undefined;

export function mapRow(record: Record<string, unknown>): ContactRow {
  const isLead = Boolean(record.Lead__c);
  const person = (isLead ? record.Lead__r : record.Contact__r) as Rel;
  const opp = record.Opportunity__r as { StageName?: string } | null | undefined;
  const first = (record.First_Name__c as string | null) ?? '';
  const last = (record.Last_Name__c as string | null) ?? '';
  const refFirst = (record.Referred_By_First_Name__c as string | null) ?? '';
  const refLast = (record.Referred_By_Last_Name__c as string | null) ?? '';

  return {
    id: (isLead ? record.Lead__c : record.Contact__c) as string,
    kind: isLead ? 'lead' : 'client',
    name: `${first} ${last}`.trim(),
    firstName: first || undefined,
    lastName: last || undefined,
    email: person?.Email || undefined,
    phone: (record.Phone__c as string | null) || undefined,
    status: isLead ? (record.Status__c as string | null) || undefined : CLIENT_STATUS,
    // A client row's Status__c is the account's newest loan stage, the fallback when the row has no loan of its own
    stage: isLead ? undefined : opp?.StageName || (record.Status__c as string | null) || undefined,
    temperature: (record.Temperature__c as string | null) || undefined,
    leadSource: (record.Lead_Source__c as string | null) || undefined,
    referredBy: `${refFirst} ${refLast}`.trim() || undefined,
    ownerName: person?.Owner?.Name || undefined,
    createdDate: (record.Created_Date__c as string | null) || undefined,
  };
}

/**
 * Rows in scope per user, for the Manage Agents / Manage LOs lists.
 * Returns a map of Salesforce Id -> count; a failed count is left out rather than shown as 0.
 */
export async function countRowsForUsers(
  role: 'loan_officer' | 'agent',
  sfIds: string[],
): Promise<Map<string, number>> {
  const ids = [...new Set(sfIds.filter(isSfId))];
  const counts = await Promise.all(
    ids.map(async id => {
      const scope: Scope = role === 'agent' ? { role, contactId: id } : { role, userId: id };
      try {
        const result = await executeSoql(buildContactQuery(scope, {}).countQuery);
        return [id, result.totalSize] as const;
      } catch (err) {
        console.error('Count failed for', id, err);
        return null;
      }
    }),
  );
  return new Map(counts.filter((c): c is readonly [string, number] => c !== null));
}
