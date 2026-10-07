/**
 * Pure helpers for match-sf-ids: turn a Lead Lens user's name into the
 * lgc-ci record Id that will scope them. No I/O here so it can be unit tested.
 */

export type MatchRole = 'agent' | 'loan_officer';

// A realtor in lgc-ci is a Contact under one of these Account record types
// (DeveloperNames, never labels). PersonAccount is a borrower.
export const REALTOR_ACCOUNT_RECORD_TYPES = ['Partner', 'Individual_Partner', 'Individual_Business_Contact'];

export interface ContactCandidate {
  Id: string;
  Name: string;
  accountName: string | null;
  recordType: string | null;
  referrals: number;
}

export interface UserCandidate {
  Id: string;
  Name: string;
  IsActive: boolean;
}

export type MatchResult =
  | { kind: 'match'; id: string; note?: string }
  | { kind: 'none'; note?: string }
  | { kind: 'ambiguous'; candidates: string[] };

export function escapeSoqlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function contactDetails(c: ContactCandidate): string {
  return `(${c.recordType ?? 'no account'}${c.accountName ? `, ${c.accountName}` : ''}, ${c.referrals} referrals)`;
}

function describeContact(c: ContactCandidate): string {
  return `${c.Id} ${contactDetails(c)}`;
}

/** Pick the agent's realtor Contact. Only a single realtor-shaped Contact is a match. */
export function classifyAgent(candidates: ContactCandidate[]): MatchResult {
  const realtors = candidates.filter(c => c.recordType && REALTOR_ACCOUNT_RECORD_TYPES.includes(c.recordType));
  if (realtors.length === 1) return { kind: 'match', id: realtors[0].Id, note: contactDetails(realtors[0]) };
  if (realtors.length > 1) return { kind: 'ambiguous', candidates: realtors.map(describeContact) };
  if (candidates.length > 0) {
    return { kind: 'none', note: `only borrower-shaped Contacts: ${candidates.map(describeContact).join('; ')}` };
  }
  return { kind: 'none' };
}

/** Pick the loan officer's User. Only a single active User is a match. */
export function classifyLoanOfficer(candidates: UserCandidate[]): MatchResult {
  const active = candidates.filter(u => u.IsActive);
  if (active.length === 1) return { kind: 'match', id: active[0].Id };
  if (active.length > 1) return { kind: 'ambiguous', candidates: active.map(u => u.Id) };
  if (candidates.length > 0) return { kind: 'none', note: `inactive only: ${candidates.map(u => u.Id).join(', ')}` };
  return { kind: 'none' };
}

export function formatResultLine(role: MatchRole, name: string, current: string | null, result: MatchResult): string {
  const label = role === 'agent' ? 'agent' : 'lo   ';
  const now = current ? ` [current ${current}]` : '';
  switch (result.kind) {
    case 'match':
      return `${label}  ${name}  ->  ${result.id}${result.note ? `  ${result.note}` : ''}${now}`;
    case 'none':
      return `${label}  ${name}  ->  NO MATCH${result.note ? `  (${result.note})` : ''}${now}`;
    case 'ambiguous':
      return `${label}  ${name}  ->  AMBIGUOUS (${result.candidates.length}): ${result.candidates.join('; ')}${now}`;
  }
}
