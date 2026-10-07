/**
 * Mock Salesforce service layer for staging/testing.
 * Activated via MOCK_SALESFORCE=true environment variable.
 * Returns lgc-ci shaped LeadAccount__c rows without making any SF API calls.
 */

import type { SFQueryResponse, SFDescribeResult } from '@lead-lens/shared';

// The staging seed users point at these, so the agent and LO dashboards have rows
export const MOCK_AGENT_CONTACT_ID = '003MOCKAGENT0001AA';
export const MOCK_LO_USER_ID = '005MOCKLO00000001A';
const OTHER_AGENT_ID = '003MOCKAGENT0002AA';
const OTHER_USER_ID = '005MOCKLO00000002A';

interface FakeRow {
  Id: string;
  Lead__c: string | null;
  Contact__c: string | null;
  First_Name__c: string;
  Last_Name__c: string;
  Phone__c: string | null;
  Status__c: string | null;
  Temperature__c: string | null;
  Lead_Source__c: string | null;
  Created_Date__c: string;
  Referred_By_First_Name__c: string | null;
  Referred_By_Last_Name__c: string | null;
  email: string | null;
  ownerId: string;
  ownerName: string;
  referredById: string | null;
  stage: string | null;
}

function lead(n: number, first: string, last: string, extra: Partial<FakeRow>): FakeRow {
  return {
    Id: `a0XMOCKROW00000${n}AA`, Lead__c: `00QMOCKLEAD0000${n}AA`, Contact__c: null,
    First_Name__c: first, Last_Name__c: last, Phone__c: `(555) 111-000${n}`,
    Status__c: 'Open', Temperature__c: null, Lead_Source__c: 'Realtor Referral',
    Created_Date__c: `2026-0${(n % 9) + 1}-1${n}`,
    Referred_By_First_Name__c: 'Test', Referred_By_Last_Name__c: 'Agent',
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    ownerId: MOCK_LO_USER_ID, ownerName: 'Test LO', referredById: MOCK_AGENT_CONTACT_ID, stage: null,
    ...extra,
  };
}

function client(n: number, first: string, last: string, stage: string, extra: Partial<FakeRow>): FakeRow {
  return lead(n, first, last, {
    Lead__c: null, Contact__c: `003MOCKCLNT0000${n}AA`, Status__c: stage, stage, ...extra,
  });
}

const FAKE_ROWS: FakeRow[] = [
  lead(1, 'John', 'Smith', { Status__c: 'Meeting Set', Temperature__c: '60 days or less' }),
  lead(2, 'Jane', 'Doe', { Status__c: 'Contacting', Temperature__c: 'Need more follow ups' }),
  client(3, 'Maria', 'Garcia', 'Processing', { Temperature__c: '60 days or less' }),
  client(4, 'David', 'Lee', 'Pre-Approved / Nurture', {}),
  lead(5, 'Olga', 'Petrova', { Status__c: 'Nurture', Temperature__c: '60 days or longer', Lead_Source__c: 'FB - Rus' }),
  lead(6, 'Sam', 'Other', {
    referredById: OTHER_AGENT_ID, Referred_By_First_Name__c: 'Other', Referred_By_Last_Name__c: 'Agent',
    ownerId: OTHER_USER_ID, ownerName: 'Other LO',
  }),
  client(7, 'Alex', 'Kim', 'Closed Won', { ownerId: OTHER_USER_ID, ownerName: 'Other LO' }),
  lead(8, 'Nina', 'Volkova', { Status__c: 'Pre-qualified', referredById: null, Referred_By_First_Name__c: null, Referred_By_Last_Name__c: null }),
];

function toRecord(r: FakeRow) {
  const person = { Email: r.email, Owner: { Name: r.ownerName } };
  return {
    attributes: { type: 'LeadAccount__c', url: `/services/data/v62.0/sobjects/LeadAccount__c/${r.Id}` },
    Id: r.Id, Lead__c: r.Lead__c, Contact__c: r.Contact__c,
    First_Name__c: r.First_Name__c, Last_Name__c: r.Last_Name__c, Phone__c: r.Phone__c,
    Status__c: r.Status__c, Temperature__c: r.Temperature__c, Lead_Source__c: r.Lead_Source__c,
    Created_Date__c: r.Created_Date__c,
    Referred_By_First_Name__c: r.Referred_By_First_Name__c, Referred_By_Last_Name__c: r.Referred_By_Last_Name__c,
    Lead__r: r.Lead__c ? person : null,
    Contact__r: r.Contact__c ? person : null,
    Opportunity__r: r.stage ? { StageName: r.stage } : null,
  };
}

const PICKLIST_VALUES: Record<string, Record<string, string[]>> = {
  Lead: {
    Status: ['Open', 'Contacting', 'Meeting Set', 'Pre-qualified', 'Nurture', 'Unqualified', 'Closed', 'Qualified', 'Pre-Approved'],
    Temperature__c: ['Dead deal', '60 days or less', 'Need more follow ups', '60 days or longer', 'Management - Please Review'],
    LeadSource: ['Realtor Referral', 'Past Client', 'FB', 'FB - Rus', 'IG', 'Social Media'],
  },
  Opportunity: {
    StageName: ['Application', 'Pre-approval', 'Pre-Approved / Nurture', 'Processing', 'Underwriting', 'Clear to Close', 'Funded', 'Closed Won', 'Closed Lost'],
  },
};

// ── Mock implementations ───────────────────────────────────────────────

export function mockExecuteSoql<T = Record<string, unknown>>(soql: string): SFQueryResponse<T> {
  let rows = [...FAKE_ROWS];

  // Scope - the builder always puts the Lead__r side first
  const agent = soql.match(/Lead__r\.Referred_By__c = '([^']+)'/);
  if (agent) rows = rows.filter(r => r.referredById === agent[1]);
  const owner = soql.match(/Lead__r\.OwnerId = '([^']+)'/);
  if (owner) rows = rows.filter(r => r.ownerId === owner[1]);

  if (soql.includes('Lead__c = null')) rows = rows.filter(r => r.Contact__c);
  const status = soql.match(/Status__c = '([^']+)'/);
  if (status) rows = rows.filter(r => r.Lead__c && r.Status__c === status[1]);
  const temp = soql.match(/Temperature__c = '([^']+)'/);
  if (temp) rows = rows.filter(r => r.Temperature__c === temp[1]);
  const like = soql.match(/First_Name__c LIKE '%([^%]+)%'/);
  if (like) {
    const s = like[1].toLowerCase();
    rows = rows.filter(r => `${r.First_Name__c} ${r.Last_Name__c}`.toLowerCase().includes(s));
  }
  const from = soql.match(/Created_Date__c >= (\d{4}-\d{2}-\d{2})/);
  if (from) rows = rows.filter(r => r.Created_Date__c >= from[1]);
  const to = soql.match(/Created_Date__c <= (\d{4}-\d{2}-\d{2})/);
  if (to) rows = rows.filter(r => r.Created_Date__c <= to[1]);

  const totalSize = rows.length;
  if (/SELECT COUNT\(\)/i.test(soql)) {
    return { totalSize, done: true, records: [] } as SFQueryResponse<T>;
  }

  rows.sort((a, b) => b.Created_Date__c.localeCompare(a.Created_Date__c));
  const limit = Number(soql.match(/LIMIT (\d+)/i)?.[1] ?? 50);
  const offset = Number(soql.match(/OFFSET (\d+)/i)?.[1] ?? 0);

  return {
    totalSize,
    done: true,
    records: rows.slice(offset, offset + limit).map(toRecord),
  } as unknown as SFQueryResponse<T>;
}

export function mockDescribeObject(sObjectType: string): SFDescribeResult {
  const fields = Object.entries(PICKLIST_VALUES[sObjectType] ?? {}).map(([name, values]) => ({
    name,
    label: name.replace(/__c$/, '').replace(/_/g, ' '),
    type: 'picklist',
    picklistValues: values.map(v => ({ active: true, value: v, label: v })),
  }));

  return { fields };
}

export function mockGetSalesforceToken(): { accessToken: string; instanceUrl: string } {
  return { accessToken: 'mock-token', instanceUrl: 'https://mock.salesforce.com' };
}
