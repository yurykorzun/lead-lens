/**
 * Mock Salesforce service layer for staging/testing.
 * Activated via MOCK_SALESFORCE=true environment variable.
 * Returns realistic fixture data without making any SF API calls.
 */

import type { SFQueryResponse, SFSaveResult, SFDescribeResult } from '@lead-lens/shared';

// ── Fake contact fixtures ──────────────────────────────────────────────

const FAKE_CONTACTS: Record<string, unknown>[] = [
  {
    Id: '003MOCK000000001', Name: 'John Smith', FirstName: 'John', LastName: 'Smith',
    Email: 'john.smith@example.com', Phone: '(555) 111-0001', MobilePhone: '(555) 222-0001',
    OwnerId: '005MOCK01', Owner: { Name: 'Leon Belov' }, CreatedDate: '2025-11-15T10:00:00.000Z',
    LastModifiedDate: '2026-02-10T14:30:00.000Z', LeadSource: 'Zillow',
    Status__c: 'Active', Temparture__c: 'Hot', No_of_Calls__c: '3',
    Message_QuickUpdate__c: 'Very interested in refinancing', Hot_Lead__c: true, PAAL__c: false,
    In_Process__c: false, Is_Client__c: false, MtgPlanner_CRM__Stage__c: 'Application',
    MtgPlanner_CRM__Thank_you_to_Referral_Source__c: false,
    BDR__c: null, Leon_BDR__c: null, Marat_BDR__c: null,
    Loan_Partners__c: 'Test LO', Leon_Loan_Partner__c: 'Test LO', Marat__c: null,
    MtgPlanner_CRM__Referred_By_Text__c: 'Test Agent',
    MtgPlanner_CRM__Last_Touch__c: 'Called on 2/10, left voicemail',
    Last_Touch_via_360_SMS__c: 'Sent follow-up SMS 2/11',
    Description: 'Looking to refinance primary residence. Currently at 6.5% rate.',
    RecordTypeId: '012MOCK01',
  },
  {
    Id: '003MOCK000000002', Name: 'Jane Doe', FirstName: 'Jane', LastName: 'Doe',
    Email: 'jane.doe@example.com', Phone: '(555) 111-0002', MobilePhone: null,
    OwnerId: '005MOCK01', Owner: { Name: 'Leon Belov' }, CreatedDate: '2025-12-01T08:00:00.000Z',
    LastModifiedDate: '2026-02-08T16:00:00.000Z', LeadSource: 'Referral',
    Status__c: 'Follow Up', Temparture__c: 'Warm', No_of_Calls__c: '1',
    Message_QuickUpdate__c: null, Hot_Lead__c: false, PAAL__c: false,
    In_Process__c: false, Is_Client__c: false, MtgPlanner_CRM__Stage__c: 'Prospect',
    MtgPlanner_CRM__Thank_you_to_Referral_Source__c: true,
    BDR__c: null, Leon_BDR__c: null, Marat_BDR__c: null,
    Loan_Partners__c: 'Test LO', Leon_Loan_Partner__c: null, Marat__c: null,
    MtgPlanner_CRM__Referred_By_Text__c: 'Test Agent',
    MtgPlanner_CRM__Last_Touch__c: null, Last_Touch_via_360_SMS__c: null,
    Description: 'First-time home buyer, pre-approved.',
    RecordTypeId: '012MOCK01',
  },
  {
    Id: '003MOCK000000003', Name: 'Robert Johnson', FirstName: 'Robert', LastName: 'Johnson',
    Email: 'robert.j@example.com', Phone: '(555) 111-0003', MobilePhone: '(555) 222-0003',
    OwnerId: '005MOCK01', Owner: { Name: 'Leon Belov' }, CreatedDate: '2026-01-10T12:00:00.000Z',
    LastModifiedDate: '2026-02-15T09:00:00.000Z', LeadSource: 'Website',
    Status__c: 'New', Temparture__c: 'Cold', No_of_Calls__c: '0',
    Message_QuickUpdate__c: null, Hot_Lead__c: false, PAAL__c: false,
    In_Process__c: false, Is_Client__c: false, MtgPlanner_CRM__Stage__c: null,
    MtgPlanner_CRM__Thank_you_to_Referral_Source__c: false,
    BDR__c: null, Leon_BDR__c: null, Marat_BDR__c: null,
    Loan_Partners__c: null, Leon_Loan_Partner__c: null, Marat__c: null,
    MtgPlanner_CRM__Referred_By_Text__c: null,
    MtgPlanner_CRM__Last_Touch__c: null, Last_Touch_via_360_SMS__c: null,
    Description: null,
    RecordTypeId: '012MOCK01',
  },
  {
    Id: '003MOCK000000004', Name: 'Maria Garcia', FirstName: 'Maria', LastName: 'Garcia',
    Email: 'maria.g@example.com', Phone: '(555) 111-0004', MobilePhone: '(555) 222-0004',
    OwnerId: '005MOCK01', Owner: { Name: 'Leon Belov' }, CreatedDate: '2026-01-20T15:00:00.000Z',
    LastModifiedDate: '2026-02-14T11:00:00.000Z', LeadSource: 'Realtor.com',
    Status__c: 'Active', Temparture__c: 'Hot', No_of_Calls__c: '5',
    Message_QuickUpdate__c: 'Ready to lock rate', Hot_Lead__c: true, PAAL__c: true,
    In_Process__c: true, Is_Client__c: false, MtgPlanner_CRM__Stage__c: 'Processing',
    MtgPlanner_CRM__Thank_you_to_Referral_Source__c: false,
    BDR__c: null, Leon_BDR__c: null, Marat_BDR__c: null,
    Loan_Partners__c: 'Test LO', Leon_Loan_Partner__c: 'Test LO', Marat__c: null,
    MtgPlanner_CRM__Referred_By_Text__c: 'Test Agent',
    MtgPlanner_CRM__Last_Touch__c: 'Spoke 2/14 — rate lock discussion',
    Last_Touch_via_360_SMS__c: 'Texted 2/14: rate lock confirmed',
    Description: 'Purchase of new construction home in Scottsdale.',
    RecordTypeId: '012MOCK01',
  },
  {
    Id: '003MOCK000000005', Name: 'David Wilson', FirstName: 'David', LastName: 'Wilson',
    Email: 'david.w@example.com', Phone: '(555) 111-0005', MobilePhone: null,
    OwnerId: '005MOCK02', Owner: { Name: 'Marat Tsirelson' }, CreatedDate: '2025-10-05T09:00:00.000Z',
    LastModifiedDate: '2026-01-20T10:00:00.000Z', LeadSource: 'Referral',
    Status__c: 'Closed', Temparture__c: 'Cold', No_of_Calls__c: '2',
    Message_QuickUpdate__c: 'Closed — funded', Hot_Lead__c: false, PAAL__c: false,
    In_Process__c: false, Is_Client__c: true, MtgPlanner_CRM__Stage__c: 'Closed',
    MtgPlanner_CRM__Thank_you_to_Referral_Source__c: true,
    BDR__c: null, Leon_BDR__c: null, Marat_BDR__c: null,
    Loan_Partners__c: null, Leon_Loan_Partner__c: null, Marat__c: null,
    MtgPlanner_CRM__Referred_By_Text__c: null,
    MtgPlanner_CRM__Last_Touch__c: 'Closing docs signed 1/20',
    Last_Touch_via_360_SMS__c: null,
    Description: 'Refinance completed successfully.',
    RecordTypeId: '012MOCK01',
  },
  {
    Id: '003MOCK000000006', Name: 'Sarah Chen', FirstName: 'Sarah', LastName: 'Chen',
    Email: 'sarah.c@example.com', Phone: '(555) 111-0006', MobilePhone: '(555) 222-0006',
    OwnerId: '005MOCK01', Owner: { Name: 'Leon Belov' }, CreatedDate: '2026-02-01T14:00:00.000Z',
    LastModifiedDate: '2026-02-17T08:00:00.000Z', LeadSource: 'Zillow',
    Status__c: 'Follow Up', Temparture__c: 'Warm', No_of_Calls__c: '2',
    Message_QuickUpdate__c: 'Scheduling appraisal', Hot_Lead__c: false, PAAL__c: false,
    In_Process__c: true, Is_Client__c: false, MtgPlanner_CRM__Stage__c: 'Underwriting',
    MtgPlanner_CRM__Thank_you_to_Referral_Source__c: false,
    BDR__c: null, Leon_BDR__c: null, Marat_BDR__c: null,
    Loan_Partners__c: 'Test LO', Leon_Loan_Partner__c: null, Marat__c: null,
    MtgPlanner_CRM__Referred_By_Text__c: 'Test Agent',
    MtgPlanner_CRM__Last_Touch__c: 'Appraisal scheduled for 2/20',
    Last_Touch_via_360_SMS__c: null,
    Description: 'Purchase in Mesa, AZ. Appraisal ordered.',
    RecordTypeId: '012MOCK01',
  },
  {
    Id: '003MOCK000000007', Name: 'Michael Brown', FirstName: 'Michael', LastName: 'Brown',
    Email: 'michael.b@example.com', Phone: '(555) 111-0007', MobilePhone: null,
    OwnerId: '005MOCK01', Owner: { Name: 'Leon Belov' }, CreatedDate: '2026-02-05T11:00:00.000Z',
    LastModifiedDate: '2026-02-16T13:00:00.000Z', LeadSource: 'Website',
    Status__c: 'New', Temparture__c: 'Warm', No_of_Calls__c: '1',
    Message_QuickUpdate__c: null, Hot_Lead__c: false, PAAL__c: false,
    In_Process__c: false, Is_Client__c: false, MtgPlanner_CRM__Stage__c: 'Prospect',
    MtgPlanner_CRM__Thank_you_to_Referral_Source__c: false,
    BDR__c: null, Leon_BDR__c: null, Marat_BDR__c: null,
    Loan_Partners__c: null, Leon_Loan_Partner__c: null, Marat__c: null,
    MtgPlanner_CRM__Referred_By_Text__c: null,
    MtgPlanner_CRM__Last_Touch__c: null, Last_Touch_via_360_SMS__c: null,
    Description: 'Inquiry about VA loan.',
    RecordTypeId: '012MOCK01',
  },
  {
    Id: '003MOCK000000008', Name: 'Emily Davis', FirstName: 'Emily', LastName: 'Davis',
    Email: 'emily.d@example.com', Phone: '(555) 111-0008', MobilePhone: '(555) 222-0008',
    OwnerId: '005MOCK01', Owner: { Name: 'Leon Belov' }, CreatedDate: '2026-01-25T16:00:00.000Z',
    LastModifiedDate: '2026-02-12T10:00:00.000Z', LeadSource: 'Referral',
    Status__c: 'Active', Temparture__c: 'Hot', No_of_Calls__c: '4',
    Message_QuickUpdate__c: 'Docs submitted', Hot_Lead__c: true, PAAL__c: false,
    In_Process__c: true, Is_Client__c: false, MtgPlanner_CRM__Stage__c: 'Application',
    MtgPlanner_CRM__Thank_you_to_Referral_Source__c: false,
    BDR__c: null, Leon_BDR__c: null, Marat_BDR__c: null,
    Loan_Partners__c: 'Test LO', Leon_Loan_Partner__c: 'Test LO', Marat__c: null,
    MtgPlanner_CRM__Referred_By_Text__c: 'Test Agent',
    MtgPlanner_CRM__Last_Touch__c: 'Reviewed docs 2/12',
    Last_Touch_via_360_SMS__c: 'SMS: docs received, thank you!',
    Description: 'FHA purchase, good credit score.',
    RecordTypeId: '012MOCK01',
  },
];

const FAKE_TASKS: Record<string, unknown>[] = [
  { Id: 'TASK001', Subject: 'Follow-up call', ActivityDate: '2026-02-10', Status: 'Completed', Description: 'Called about rate options', CreatedDate: '2026-02-10T10:00:00.000Z' },
  { Id: 'TASK002', Subject: 'Send pre-approval letter', ActivityDate: '2026-02-12', Status: 'Completed', Description: 'Emailed pre-approval', CreatedDate: '2026-02-12T14:00:00.000Z' },
  { Id: 'TASK003', Subject: 'Schedule appraisal', ActivityDate: '2026-02-15', Status: 'In Progress', Description: null, CreatedDate: '2026-02-15T09:00:00.000Z' },
];

const FAKE_HISTORY: Record<string, unknown>[] = [
  { Field: 'Status__c', OldValue: 'New', NewValue: 'Active', CreatedDate: '2026-02-08T10:00:00.000Z', CreatedBy: { Name: 'Leon Belov' } },
  { Field: 'Temparture__c', OldValue: 'Cold', NewValue: 'Warm', CreatedDate: '2026-02-10T14:00:00.000Z', CreatedBy: { Name: 'Leon Belov' } },
  { Field: 'MtgPlanner_CRM__Stage__c', OldValue: 'Prospect', NewValue: 'Application', CreatedDate: '2026-02-12T09:00:00.000Z', CreatedBy: { Name: 'Leon Belov' } },
];

// ── Picklist values (matches real SF org) ──────────────────────────────

const PICKLIST_VALUES: Record<string, Array<{ active: boolean; value: string; label: string }>> = {
  Status__c: [
    { active: true, value: 'New', label: 'New' },
    { active: true, value: 'Active', label: 'Active' },
    { active: true, value: 'Follow Up', label: 'Follow Up' },
    { active: true, value: 'Closed', label: 'Closed' },
    { active: true, value: 'Dead', label: 'Dead' },
  ],
  Temparture__c: [
    { active: true, value: 'Hot', label: 'Hot' },
    { active: true, value: 'Warm', label: 'Warm' },
    { active: true, value: 'Cold', label: 'Cold' },
  ],
  No_of_Calls__c: [
    { active: true, value: '0', label: '0' },
    { active: true, value: '1', label: '1' },
    { active: true, value: '2', label: '2' },
    { active: true, value: '3', label: '3' },
    { active: true, value: '4', label: '4' },
    { active: true, value: '5', label: '5' },
  ],
  'MtgPlanner_CRM__Stage__c': [
    { active: true, value: 'Prospect', label: 'Prospect' },
    { active: true, value: 'Application', label: 'Application' },
    { active: true, value: 'Processing', label: 'Processing' },
    { active: true, value: 'Underwriting', label: 'Underwriting' },
    { active: true, value: 'Closed', label: 'Closed' },
  ],
  BDR__c: [
    { active: true, value: 'Leon', label: 'Leon' },
    { active: true, value: 'Marat', label: 'Marat' },
  ],
  Leon_BDR__c: [
    { active: true, value: 'Leon', label: 'Leon' },
  ],
  Marat_BDR__c: [
    { active: true, value: 'Marat', label: 'Marat' },
  ],
  Loan_Partners__c: [
    { active: true, value: 'Test LO', label: 'Test LO' },
  ],
  Leon_Loan_Partner__c: [
    { active: true, value: 'Test LO', label: 'Test LO' },
  ],
  'Marat__c': [
    { active: true, value: 'Test LO', label: 'Test LO' },
  ],
  LeadSource: [
    { active: true, value: 'Zillow', label: 'Zillow' },
    { active: true, value: 'Referral', label: 'Referral' },
    { active: true, value: 'Website', label: 'Website' },
    { active: true, value: 'Realtor.com', label: 'Realtor.com' },
  ],
};

// ── Mock implementations ───────────────────────────────────────────────

function addAttributes(records: Record<string, unknown>[]): Array<Record<string, unknown> & { attributes: { type: string; url: string } }> {
  return records.map(r => ({
    ...r,
    attributes: { type: 'Contact', url: `/services/data/v62.0/sobjects/Contact/${r.Id}` },
  }));
}

export function mockExecuteSoql<T = Record<string, unknown>>(soql: string): SFQueryResponse<T> {
  const upper = soql.toUpperCase();

  // COUNT query
  if (upper.includes('SELECT COUNT()')) {
    // Filter by scope if present
    let count = FAKE_CONTACTS.length;

    // Simple name-based scope filtering
    const nameMatch = soql.match(/= '([^']+)'/);
    if (nameMatch) {
      const name = nameMatch[1];
      if (upper.includes('LOAN_PARTNERS__C') || upper.includes('LEON_LOAN_PARTNER__C')) {
        count = FAKE_CONTACTS.filter(c =>
          c.Loan_Partners__c === name || c.Leon_Loan_Partner__c === name || c.Marat__c === name
        ).length;
      } else if (upper.includes('REFERRED_BY_TEXT__C')) {
        count = FAKE_CONTACTS.filter(c => c.MtgPlanner_CRM__Referred_By_Text__c === name).length;
      }
    }

    return { totalSize: count, done: true, records: [] } as SFQueryResponse<T>;
  }

  // Task query
  if (upper.includes('FROM TASK')) {
    return {
      totalSize: FAKE_TASKS.length,
      done: true,
      records: addAttributes(FAKE_TASKS),
    } as SFQueryResponse<T>;
  }

  // ContactHistory query
  if (upper.includes('FROM CONTACTHISTORY')) {
    return {
      totalSize: FAKE_HISTORY.length,
      done: true,
      records: addAttributes(FAKE_HISTORY),
    } as SFQueryResponse<T>;
  }

  // Contact query — apply basic filtering
  let filtered = [...FAKE_CONTACTS];

  // Name search
  const likeMatch = soql.match(/Name LIKE '%([^%]+)%'/i);
  if (likeMatch) {
    const search = likeMatch[1].toLowerCase();
    filtered = filtered.filter(c => (c.Name as string).toLowerCase().includes(search));
  }

  // Status filter
  const statusMatch = soql.match(/Status__c = '([^']+)'/);
  if (statusMatch) {
    filtered = filtered.filter(c => c.Status__c === statusMatch[1]);
  }

  // Temperature filter
  const tempMatch = soql.match(/Temparture__c = '([^']+)'/);
  if (tempMatch) {
    filtered = filtered.filter(c => c.Temparture__c === tempMatch[1]);
  }

  // Scope filtering (LO or Agent)
  if (upper.includes('LOAN_PARTNERS__C') || upper.includes('LEON_LOAN_PARTNER__C')) {
    const scopeMatch = soql.match(/Loan_Partners__c = '([^']+)'/);
    if (scopeMatch) {
      const name = scopeMatch[1];
      filtered = filtered.filter(c =>
        c.Loan_Partners__c === name || c.Leon_Loan_Partner__c === name || c.Marat__c === name
      );
    }
  } else if (upper.includes('REFERRED_BY_TEXT__C')) {
    const scopeMatch = soql.match(/Referred_By_Text__c = '([^']+)'/);
    if (scopeMatch) {
      const name = scopeMatch[1];
      filtered = filtered.filter(c => c.MtgPlanner_CRM__Referred_By_Text__c === name);
    }
  }

  // Pagination
  const limitMatch = soql.match(/LIMIT (\d+)/i);
  const offsetMatch = soql.match(/OFFSET (\d+)/i);
  const totalSize = filtered.length;
  const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;
  const limit = limitMatch ? parseInt(limitMatch[1]) : 50;
  filtered = filtered.slice(offset, offset + limit);

  return {
    totalSize,
    done: true,
    records: addAttributes(filtered),
  } as SFQueryResponse<T>;
}

export function mockBulkUpdate(
  _sObjectType: string,
  records: Array<{ Id: string } & Record<string, unknown>>,
): SFSaveResult[] {
  return records.map(r => ({
    id: r.Id,
    success: true,
    errors: [],
  }));
}

export function mockDescribeObject(_sObjectType: string): SFDescribeResult {
  const fields = Object.entries(PICKLIST_VALUES).map(([name, picklistValues]) => ({
    name,
    label: name.replace(/__c$/, '').replace(/_/g, ' '),
    type: 'picklist',
    picklistValues,
  }));

  return { fields };
}

export function mockVerifyContactScope(ids: string[]): Set<string> {
  return new Set(ids);
}

export function mockCountContactsForUsers(userNames: string[]): Map<string, number> {
  return new Map(userNames.map(name => {
    const count = FAKE_CONTACTS.filter(c =>
      c.Loan_Partners__c === name || c.Leon_Loan_Partner__c === name ||
      c.Marat__c === name || c.MtgPlanner_CRM__Referred_By_Text__c === name
    ).length;
    return [name, count || 3]; // fallback to 3 so counts always show
  }));
}

export function mockGetSalesforceToken(): { accessToken: string; instanceUrl: string } {
  return { accessToken: 'mock-token', instanceUrl: 'https://mock.salesforce.com' };
}
