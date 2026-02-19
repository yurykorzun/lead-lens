export interface ContactRow {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  status?: string;
  temperature?: string;
  noOfCalls?: number;
  message?: string;
  hotLead?: boolean;
  paal?: boolean;
  inProcess?: boolean;
  stage?: string;
  thankYouToReferralSource?: boolean;
  bdr?: string;
  loanPartner?: string;
  leonLoanPartner?: string;
  maratLoanPartner?: string;
  leonBdr?: string;
  maratBdr?: string;
  leadSource?: string;
  isClient?: boolean;
  referredByText?: string;
  lastTouch?: string;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  recordType?: string;
  createdDate?: string;
  lastModifiedDate?: string;
}

export interface ContactFilters {
  loanOfficerId?: string;
  search?: string;
  status?: string;
  temperature?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface BulkUpdatePayload {
  updates: Array<{
    id: string;
    fields: Partial<Omit<ContactRow, 'id' | 'name' | 'firstName' | 'lastName' | 'email' | 'phone' | 'mobilePhone' | 'ownerId' | 'ownerName' | 'recordType' | 'createdDate' | 'lastModifiedDate'>>;
  }>;
}
