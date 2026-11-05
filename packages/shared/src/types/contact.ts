// One row per person on the lgc-ci Originator Tracker mirror (LeadAccount__c):
// an open borrower Lead, or a client (person account) and their loan.
// There are no free-text fields on purpose - the team's internal notes never leave the org.
// Realtor notes (Realtor_Note__c) come separately, through the notes routes.
export interface ContactRow {
  id: string; // Lead Id, or the person account's Contact Id
  kind: 'lead' | 'client';
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status?: string; // Lead status, or CLIENT_STATUS for a client
  stage?: string; // loan stage, clients only
  temperature?: string;
  leadSource?: string;
  referredBy?: string;
  ownerName?: string;
  createdDate?: string; // YYYY-MM-DD, the tracker's Created date
}

export const CLIENT_STATUS = 'Client';

export type NoteAuthorRole = 'admin' | 'loan_officer' | 'agent' | 'loan_partner';

/** Where a note was written: in Lead Lens, or by the team in Salesforce */
export type NoteSource = 'Lead Lens' | 'Salesforce';

/**
 * A realtor note on a borrower (Realtor_Note__c in lgc-ci), shared by the realtor, her
 * loan officer and admins. Notes written before the move to Salesforce still come from the
 * Lead Lens database until they are copied over, marked with `history`.
 */
export interface ContactNote {
  id: string;
  body: string;
  authorName: string;
  /** Missing when Salesforce holds a role Lead Lens does not know */
  authorRole?: NoteAuthorRole;
  source: NoteSource;
  /** An older note from the Lead Lens database, not yet copied to Salesforce */
  history?: boolean;
  /** ISO date-time; empty when Salesforce has no Written At */
  createdAt: string;
  /** Written by the user reading it (display only) */
  mine: boolean;
}

export const NOTE_MAX_LENGTH = 2000;

/**
 * A Salesforce Task from the fixed realtor set (call 1/2/3, showing 1/2/3). Salesforce
 * creates the set; Lead Lens only lists it and lets the realtor mark one done.
 * No description, because Task bodies carry internal notes.
 */
export interface RealtorTask {
  id: string;
  subject: string;
  /** YYYY-MM-DD */
  dueDate?: string;
  status: string;
  done: boolean;
  /** The borrower row (Lead or person Contact Id) the task is on */
  borrowerId: string;
  borrowerName?: string;
  /** Only the realtor the task is for can complete it */
  canComplete: boolean;
}

export interface ContactFilters {
  search?: string;
  status?: string;
  temperature?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}
