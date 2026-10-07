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

export interface ContactFilters {
  search?: string;
  status?: string;
  temperature?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}
