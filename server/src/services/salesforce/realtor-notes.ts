import type { ContactNote, NoteAuthorRole, NoteSource, SFQueryResponse } from '@lead-lens/shared';
import { getSalesforceToken } from './auth.js';
import { executeSoql, quoteId, type RowIds } from './query.js';
import { mockCreateRecord } from './mock.js';
import { isSfId } from '../validate.js';

// Realtor notes live on Realtor_Note__c in lgc-ci (lendinggroupco-uhnx.12): the realtor
// writes them here, the LO writes them in Salesforce with "Note to Realtor", and both sides
// read the same thread. The object holds only notes meant for the realtor - the team's own
// notes (Rep_Notes__c, Message_to_Realtor__c, Description, Rep_Note_History__c) stay out.
//
// THE SECOND SALESFORCE WRITE IN LEAD LENS: one insert per note. The body is built field
// by field from the allowlist below; nothing from the request is spread into it.
// Realtor_Note__c is append-only (a validation rule refuses every update), so there is no
// edit or delete path.
export const NOTE_FIELDS = 'Id, Body__c, Author_Name__c, Author_Role__c, Source__c, Written_At__c';
export const NOTE_INSERT_FIELDS = Object.freeze([
  'Body__c', 'Parent_Lead__c', 'Parent_Contact__c', 'Parent_Account__c', 'Author_Name__c', 'Author_Role__c', 'Source__c',
] as const);

const ROLE_TO_SF: Record<string, string> = {
  agent: 'Realtor',
  loan_officer: 'Loan Officer',
  admin: 'Admin',
};
const SF_TO_ROLE: Record<string, NoteAuthorRole> = {
  'Realtor': 'agent',
  'Loan Officer': 'loan_officer',
  'Admin': 'admin',
  'Loan Partner': 'loan_partner',
};

const AUTHOR_NAME_MAX = 255;

/**
 * Notes parented to any record on the borrower's row, newest first. No LIMIT: the old
 * Lead Lens thread showed every note, so listRealtorNotes follows nextRecordsUrl instead.
 */
export function buildNotesQuery(ids: RowIds): string | null {
  const parts: string[] = [];
  const clause = (field: string, list: string[]) => {
    if (list.length) parts.push(`${field} IN (${list.map(quoteId).join(', ')})`);
  };
  clause('Parent_Lead__c', ids.leadIds);
  clause('Parent_Contact__c', ids.contactIds);
  clause('Parent_Account__c', ids.accountIds);
  clause('Parent_Opportunity__c', ids.opportunityIds);
  // Only a second loan has its own tracker row, so a note written on the first loan's
  // Opportunity page is found through the person account it belongs to. For a realtor,
  // only loans she referred (or with no referring agent): a second loan can be another realtor's.
  if (ids.accountIds.length) {
    const realtor = ids.loanRealtorId === undefined ? '' :
      ` AND (Parent_Opportunity__r.Referring_Agent__c = ${quoteId(ids.loanRealtorId)} OR Parent_Opportunity__r.Referring_Agent__c = null)`;
    parts.push(`(Parent_Opportunity__r.AccountId IN (${ids.accountIds.map(quoteId).join(', ')})${realtor})`);
  }
  if (parts.length === 0) return null;
  return `SELECT ${NOTE_FIELDS} FROM Realtor_Note__c WHERE (${parts.join(' OR ')})` +
    ' ORDER BY Written_At__c DESC NULLS LAST, Id DESC';
}

export interface NoteAuthor {
  name: string;
  role: string;
}

export type NoteInsertBody = Partial<Record<(typeof NOTE_INSERT_FIELDS)[number], string>>;

/**
 * The insert body for one note. A Lead row is parented by Lead, a person account row by
 * Contact - the same Id the borrower is on the dashboard by - and by its person account
 * too (personAccountId), because the Realtor Notes list on the person account page is
 * keyed on Account Id. Without it the LO would not see the note there.
 */
export function buildNoteInsert(recordId: string, body: string, author: NoteAuthor, personAccountId?: string): NoteInsertBody {
  if (!isSfId(recordId)) throw new Error('Invalid Salesforce Id');
  const role = ROLE_TO_SF[author.role];
  if (!role) throw new Error('Unknown author role');
  const insert: NoteInsertBody = { Body__c: String(body) };
  if (recordId.startsWith('00Q')) insert.Parent_Lead__c = recordId;
  else if (recordId.startsWith('003')) {
    insert.Parent_Contact__c = recordId;
    if (personAccountId !== undefined) {
      if (!isSfId(personAccountId) || !personAccountId.startsWith('001')) throw new Error('Invalid account Id');
      insert.Parent_Account__c = personAccountId;
    }
  } else throw new Error('A note must be on a Lead or a Contact');
  insert.Author_Name__c = String(author.name || 'Unknown').slice(0, AUTHOR_NAME_MAX);
  insert.Author_Role__c = role;
  insert.Source__c = 'Lead Lens';
  return insert;
}

export interface NoteRecord {
  Id: string;
  Body__c: string | null;
  Author_Name__c: string | null;
  Author_Role__c: string | null;
  Source__c: string | null;
  Written_At__c: string | null;
}

/**
 * Never "mine" (the "You" label): Salesforce keeps no Lead Lens user Id, and matching by
 * name would label another user's note as yours when two users share a name. The note
 * shows its author's name instead.
 */
export function mapNote(r: NoteRecord): ContactNote {
  const source: NoteSource = r.Source__c === 'Lead Lens' ? 'Lead Lens' : 'Salesforce';
  const authorRole = r.Author_Role__c ? SF_TO_ROLE[r.Author_Role__c] : undefined;
  return {
    id: r.Id,
    body: r.Body__c ?? '',
    authorName: r.Author_Name__c || 'Unknown',
    authorRole,
    source,
    createdAt: r.Written_At__c ?? '',
    mine: false,
  };
}

export async function listRealtorNotes(ids: RowIds): Promise<ContactNote[]> {
  const soql = buildNotesQuery(ids);
  if (!soql) return [];
  const result = await executeSoql<NoteRecord>(soql);
  const records: NoteRecord[] = [...result.records];
  let next = result.done ? undefined : result.nextRecordsUrl;
  if (next) {
    // Later pages of the same query. A failed page fails the call, so the thread is never shown half
    const { accessToken, instanceUrl } = await getSalesforceToken();
    while (next) {
      const response = await fetch(`${instanceUrl}${next}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(`SOQL query failed: ${response.status} ${await response.text()}`);
      const page = await response.json() as SFQueryResponse<NoteRecord>;
      records.push(...page.records);
      next = page.done ? undefined : page.nextRecordsUrl;
    }
  }
  return records.map(mapNote);
}

/** Inserts one note and returns its Salesforce Id */
export async function createRealtorNote(recordId: string, body: string, author: NoteAuthor, personAccountId?: string): Promise<string> {
  const insert = buildNoteInsert(recordId, body, author, personAccountId);
  if (process.env.MOCK_SALESFORCE === 'true') return mockCreateRecord('Realtor_Note__c', insert);

  const { accessToken, instanceUrl } = await getSalesforceToken();
  const response = await fetch(
    `${instanceUrl}/services/data/${process.env.SF_API_VERSION || 'v62.0'}/sobjects/Realtor_Note__c`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(insert),
    },
  );
  if (!response.ok) {
    throw new Error(`Realtor note insert failed: ${response.status} ${await response.text()}`);
  }
  const created = await response.json() as { id?: string; success?: boolean };
  if (!created.success || !isSfId(created.id)) throw new Error('Realtor note insert returned no Id');
  return created.id;
}
