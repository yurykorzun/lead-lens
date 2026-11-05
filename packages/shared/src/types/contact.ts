// One row per person on the lgc-ci Originator Tracker mirror (LeadAccount__c):
// an open borrower Lead, or a client (person account) and their loan.
// There are no free-text fields on purpose - notes are internal and never leave the org.
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

/** A note on a borrower, kept in Lead Lens only - never written to Salesforce */
export interface ContactNote {
  id: string;
  body: string;
  authorName: string;
  authorRole: 'admin' | 'loan_officer' | 'agent';
  createdAt: string;
  /** Written by the user reading it */
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
