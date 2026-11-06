import { buildNoteInsert } from './salesforce/realtor-notes.js';

// lendinggroupco-uhnx.12.4: notes written before Lead Lens moved to Realtor_Note__c sit in
// the Neon `notes` table. scripts/move-notes-to-salesforce.ts copies each one over with
// the same insert the app uses, plus its original date, and these pure parts decide what
// it writes.

export interface NeonNote {
  id: string;
  sfRecordId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: Date;
}

/** What Salesforce says about the Lead a note was written on */
export interface LeadConversion {
  Id: string;
  IsConverted: boolean;
  ConvertedContactId: string | null;
  ConvertedAccountId: string | null;
  personAccount: boolean;
}

/** The account behind a Contact a note was written on */
export interface ContactAccount {
  Id: string;
  AccountId: string | null;
  personAccount: boolean;
}

/** A Lead Lens note already in Realtor_Note__c */
export interface MovedNote {
  Id: string;
  Body__c: string | null;
  Author_Name__c: string | null;
  Written_At__c: string | null;
  Parent_Lead__c: string | null;
  Parent_Contact__c: string | null;
}

/**
 * The insert for one old note: the app's own allowlisted body (so a moved note reads like
 * one written today) plus Written_At__c, its original time. A note on a Lead that has
 * since converted also gets the converted Contact (and the person account), because
 * the convert carry-over only runs at convert time and the LO works the converted record.
 */
export function buildMovedNoteInsert(note: NeonNote, lead?: LeadConversion, contact?: ContactAccount): Record<string, string> {
  // A note on a person account's Contact also gets the account, as the app does today
  const personAccountId = contact?.personAccount && contact.AccountId ? contact.AccountId : undefined;
  const insert: Record<string, string> = {
    ...buildNoteInsert(note.sfRecordId, note.body, { name: note.authorName, role: note.authorRole }, personAccountId),
    Written_At__c: note.createdAt.toISOString(),
  };
  if (lead?.IsConverted && lead.ConvertedContactId) {
    insert.Parent_Contact__c = lead.ConvertedContactId;
    if (lead.personAccount && lead.ConvertedAccountId) insert.Parent_Account__c = lead.ConvertedAccountId;
  }
  return insert;
}

/**
 * True when this note is already in Salesforce: same record, author and text, written
 * within a second (Salesforce keeps DateTime to the second). Realtor_Note__c has no
 * external Id field, so this is what makes a second run write nothing.
 */
export function isAlreadyMoved(note: NeonNote, existing: MovedNote[]): boolean {
  const at = note.createdAt.getTime();
  return existing.some(e =>
    (e.Parent_Lead__c === note.sfRecordId || e.Parent_Contact__c === note.sfRecordId) &&
    (e.Author_Name__c ?? '') === note.authorName.slice(0, 255) &&
    (e.Body__c ?? '') === note.body &&
    e.Written_At__c !== null && Math.abs(new Date(e.Written_At__c).getTime() - at) < 1000,
  );
}

export function parentType(sfRecordId: string): 'Lead' | 'Contact' | 'other' {
  if (sfRecordId.startsWith('00Q')) return 'Lead';
  if (sfRecordId.startsWith('003')) return 'Contact';
  return 'other';
}
