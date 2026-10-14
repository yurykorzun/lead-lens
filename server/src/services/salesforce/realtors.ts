import type { RealtorMatch } from '@lead-lens/shared';
import { executeSoql, countRowsForUsers } from './query.js';
import { isSfId } from '../validate.js';

// An agent login is scoped by the Contact Id its borrowers point at (Referred By on the
// lead or client, Referring Agent on the loan). Typing that Id by hand left three agents
// unlinked on 2026-10-14, all seeing an empty dashboard, so admins pick the record here
// instead and the server checks it exists before saving.
//
// Not filtered to realtor record types: 477 leads were referred by a past client (a
// person account) and 45 by a business contact, and those referrers can have a login too.

const FIELDS = 'Id, Name, Email, Account.Name, Account.RecordType.DeveloperName';
const MIN_TERM = 2;
const MAX_RESULTS = 10;

// DeveloperNames, because a label can be renamed in Setup
const KIND_LABELS: Record<string, string> = {
  Partner: 'Realtor',
  Individual_Partner: 'Realtor',
  Individual_Business_Contact: 'Business contact',
  PersonAccount: 'Borrower',
};

type ContactRecord = {
  Id: string;
  Name?: string | null;
  Email?: string | null;
  Account?: { Name?: string | null; RecordType?: { DeveloperName?: string | null } | null } | null;
};

// Quotes escaped for the string literal, then % and _ so a search for "a_b" is literal
export function escapeLike(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

export function buildRealtorSearchQuery(term: string): string | null {
  const t = term.trim();
  if (t.length < MIN_TERM) return null;
  const s = escapeLike(t);
  return `SELECT ${FIELDS} FROM Contact WHERE Name LIKE '%${s}%' OR Email LIKE '%${s}%' ORDER BY Name LIMIT 20`;
}

export function buildRealtorByIdQuery(id: string): string {
  if (!isSfId(id)) throw new Error('Invalid Salesforce Id');
  return `SELECT ${FIELDS} FROM Contact WHERE Id = '${id}'`;
}

function toMatch(r: ContactRecord, borrowers: number | undefined): RealtorMatch {
  const type = r.Account?.RecordType?.DeveloperName ?? '';
  return {
    id: r.Id,
    name: r.Name ?? '',
    email: r.Email ?? undefined,
    company: type === 'Partner' ? r.Account?.Name ?? undefined : undefined,
    kind: KIND_LABELS[type] ?? 'Contact',
    borrowers,
  };
}

/**
 * Contacts whose name or email contains the term, the ones with the most referred
 * borrowers first - so a realtor's empty duplicate sorts below the record that carries
 * the referrals.
 */
export async function searchRealtors(term: string): Promise<RealtorMatch[]> {
  const soql = buildRealtorSearchQuery(term);
  if (!soql) return [];
  const { records } = await executeSoql<ContactRecord>(soql);
  const counts = await countRowsForUsers('agent', records.map(r => r.Id));
  return records
    .map(r => toMatch(r, counts.get(r.Id)))
    .sort((a, b) => (b.borrowers ?? -1) - (a.borrowers ?? -1) || a.name.localeCompare(b.name))
    .slice(0, MAX_RESULTS);
}

/** The Contact behind an Id, or null when there is none. Returns the 18-character Id. */
export async function findRealtor(id: string): Promise<RealtorMatch | null> {
  if (!isSfId(id)) return null;
  const { records } = await executeSoql<ContactRecord>(buildRealtorByIdQuery(id));
  if (records.length === 0) return null;
  const counts = await countRowsForUsers('agent', [records[0].Id]);
  return toMatch(records[0], counts.get(records[0].Id));
}
