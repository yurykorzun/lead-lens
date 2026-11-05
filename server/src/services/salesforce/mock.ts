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
  Account__c: string | null;
  Opportunity__c: string | null;
  First_name__c: string;
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
    Account__c: null, Opportunity__c: null,
    First_name__c: first, Last_Name__c: last, Phone__c: `(555) 111-000${n}`,
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
    Lead__c: null, Contact__c: `003MOCKCLNT0000${n}AA`, Account__c: `001MOCKACCT0000${n}AA`,
    Opportunity__c: `006MOCKOPPT0000${n}AA`, Status__c: stage, stage, ...extra,
  });
}

// Lead 2 (Jane Doe) is mid-conversion: her row carries both the Lead and the new Contact Id,
// and she has realtor notes on each (see FAKE_NOTES)
const JANE_CONTACT_ID = '003MOCKCONV00002AA';

const FAKE_ROWS: FakeRow[] = [
  lead(1, 'John', 'Smith', { Status__c: 'Meeting Set', Temperature__c: '60 days or less' }),
  lead(2, 'Jane', 'Doe', {
    Status__c: 'Contacting', Temperature__c: 'Need more follow ups',
    Contact__c: JANE_CONTACT_ID, Account__c: '001MOCKACCT00002AA',
  }),
  client(3, 'Maria', 'Garcia', 'Processing', { Temperature__c: '60 days or less' }),
  client(4, 'David', 'Lee', 'Documents Gathering', { Phone__c: '15551110004' }),
  lead(5, 'Olga', 'Petrova', { Status__c: 'Nurture', Temperature__c: '60 days or longer', Lead_Source__c: 'FB - Rus', Phone__c: '+7 916 123-45-67' }),
  lead(6, 'Sam', 'Other', {
    referredById: OTHER_AGENT_ID, Referred_By_First_Name__c: 'Other', Referred_By_Last_Name__c: 'Agent',
    ownerId: OTHER_USER_ID, ownerName: 'Other LO',
  }),
  client(7, 'Alex', 'Kim', 'Closed Won', { ownerId: OTHER_USER_ID, ownerName: 'Other LO' }),
  lead(8, 'Nina', 'Volkova', { Status__c: 'Qualified', referredById: null, Referred_By_First_Name__c: null, Referred_By_Last_Name__c: null }),
];

function toRecord(r: FakeRow) {
  const person = { Email: r.email, Owner: { Name: r.ownerName } };
  return {
    attributes: { type: 'LeadAccount__c', url: `/services/data/v62.0/sobjects/LeadAccount__c/${r.Id}` },
    Id: r.Id, Lead__c: r.Lead__c, Contact__c: r.Contact__c,
    Account__c: r.Account__c, Opportunity__c: r.Opportunity__c,
    First_name__c: r.First_name__c, Last_Name__c: r.Last_Name__c, Phone__c: r.Phone__c,
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
    // lgc-ci values (GROUP BY, 2026-10-15)
    Status: ['Open', 'Open - Not Contacted', 'Contacting', 'Meeting Set', 'Qualified', 'Pre-Approved', 'Preapproved - 6 Months & Older', 'Nurture', 'Unqualified', 'Closed', 'Duplicate', 'Not a lead'],
    Temperature__c: ['Dead deal', '60 days or less', 'Need more follow ups', '60 days or longer', 'Management - Please Review'],
    LeadSource: ['Realtor Referral', 'Past Client', 'FB', 'FB - Rus', 'IG', 'Social Media'],
  },
  Opportunity: {
    StageName: ['Application', 'Pre-approval', 'Documents Gathering', 'Pre-Approved / Nurture', 'Under Contract', 'Processing', 'Underwriting', 'Conditional Loan Approval', 'Clear to Close', 'Close', 'Funded', 'Sold / Funds Received', 'Closed Won', 'Closed Lost', 'Dead Deal'],
  },
};

// ── Mock implementations ───────────────────────────────────────────────

// The Contacts an agent login can be linked to (Manage Agents search)
const FAKE_CONTACTS = [
  { Id: MOCK_AGENT_CONTACT_ID, Name: 'Test Agent', Email: 'agent@test.com', Account: { Name: 'Test Realty', RecordType: { DeveloperName: 'Partner' } } },
  { Id: OTHER_AGENT_ID, Name: 'Other Agent', Email: 'other.agent@test.com', Account: { Name: 'Other Agent', RecordType: { DeveloperName: 'Individual_Partner' } } },
  { Id: '003MOCKAGENT0003AA', Name: 'Test Agent', Email: null, Account: { Name: 'Old Brokerage', RecordType: { DeveloperName: 'Partner' } } },
];

function mockContactQuery(soql: string) {
  const id = soql.match(/WHERE Id = '([^']+)'/);
  const like = soql.match(/Name LIKE '%(.+?)%' OR/);
  const term = like?.[1].replace(/\\(.)/g, '$1').toLowerCase();
  const records = FAKE_CONTACTS.filter(c =>
    id ? c.Id === id[1] : !term || c.Name.toLowerCase().includes(term) || (c.Email ?? '').toLowerCase().includes(term));
  return { totalSize: records.length, done: true, records };
}

// ── Realtor tasks (lendinggroupco-uhnx.11) ─────────────────────────────
// Lead 1 (John Smith, the test agent's) has her three, an LP task with no realtor stamp,
// and another realtor's. Task 7 is hers but on lead 6, which the other agent now refers.

interface FakeTask {
  Id: string; Subject: string; ActivityDate: string | null; Status: string; IsClosed: boolean;
  WhoId: string; Realtor_Contact__c: string | null; Description: string | null;
}

function task(n: number, whoN: number, realtor: string | null, subject: string, due: string): FakeTask {
  return {
    Id: `00TMOCKTASK0000${n}AA`, Subject: subject, ActivityDate: due, Status: 'Not Started', IsClosed: false,
    WhoId: `00QMOCKLEAD0000${whoN}AA`, Realtor_Contact__c: realtor,
    Description: realtor ? null : 'LP internal note - must never reach Lead Lens',
  };
}

const INITIAL_TASKS: FakeTask[] = [
  task(1, 1, MOCK_AGENT_CONTACT_ID, 'Realtor: Call 1', '2026-11-04'),
  task(2, 1, MOCK_AGENT_CONTACT_ID, 'Realtor: Call 2', '2026-11-05'),
  task(3, 1, MOCK_AGENT_CONTACT_ID, 'Realtor: Showing 1', '2026-11-10'),
  task(4, 1, null, 'Follow up on pre-approval', '2026-11-01'),
  task(5, 1, OTHER_AGENT_ID, 'Realtor: Call 1', '2026-11-03'),
  task(6, 2, MOCK_AGENT_CONTACT_ID, 'Realtor: Call 1', '2026-11-12'),
  task(7, 6, MOCK_AGENT_CONTACT_ID, 'Realtor: Call 3', '2026-11-06'),
];

let fakeTasks: FakeTask[] = INITIAL_TASKS.map(t => ({ ...t }));

/** Every write the mock received, so tests can prove exactly what would reach Salesforce */
export const mockWrites: { sobject: string; id: string; body: Record<string, unknown> }[] = [];

export function resetMockTasks() {
  fakeTasks = INITIAL_TASKS.map(t => ({ ...t }));
  mockWrites.length = 0;
}

export function mockUpdateRecord(sobject: string, id: string, body: Record<string, unknown>) {
  mockWrites.push({ sobject, id, body: { ...body } });
  const t = sobject === 'Task' ? fakeTasks.find(x => x.Id === id) : undefined;
  if (!t) throw new Error(`Mock update failed: 404 ${sobject} ${id}`);
  if (body.Status === 'Completed') Object.assign(t, { Status: 'Completed', IsClosed: true });
}

function mockTaskQuery(soql: string) {
  let tasks = [...fakeTasks];
  const id = soql.match(/WHERE Id = '([^']+)'/);
  if (id) tasks = tasks.filter(t => t.Id === id[1]);
  const who = soql.match(/WhoId = '([^']+)'/);
  if (who) tasks = tasks.filter(t => t.WhoId === who[1]);
  const realtor = soql.match(/Realtor_Contact__c = '([^']+)'/);
  if (realtor) tasks = tasks.filter(t => t.Realtor_Contact__c === realtor[1]);
  if (soql.includes('Realtor_Contact__c != null')) tasks = tasks.filter(t => t.Realtor_Contact__c);
  if (soql.includes('IsClosed = false')) tasks = tasks.filter(t => !t.IsClosed);
  tasks.sort((a, b) => (a.ActivityDate ?? '9999').localeCompare(b.ActivityDate ?? '9999') || a.Id.localeCompare(b.Id));
  // Only the selected fields, like the real API - so a leak of Description would show in tests
  const fields = soql.match(/SELECT (.+?) FROM/)![1].split(',').map(f => f.trim()) as (keyof FakeTask)[];
  const records = tasks.map(t => ({
    attributes: { type: 'Task', url: `/services/data/v62.0/sobjects/Task/${t.Id}` },
    ...Object.fromEntries(fields.map(f => [f, t[f]])),
  }));
  return { totalSize: records.length, done: true, records };
}

// ── Realtor notes (lendinggroupco-uhnx.12) ─────────────────────────────
// Jane Doe (lead 2) has one note on her Lead and one on her new Contact. Maria Garcia has an
// LO note on her loan. Lead 6 has the other realtor's note. John Smith starts with none.

interface FakeNote {
  Id: string; Body__c: string; Author_Name__c: string; Author_Role__c: string; Source__c: string;
  Written_At__c: string | null; Parent_Lead__c: string | null; Parent_Contact__c: string | null;
  Parent_Account__c: string | null; Parent_Opportunity__c: string | null;
}

function note(n: number, parent: Partial<FakeNote>, author: string, role: string, source: string, at: string, body: string): FakeNote {
  return {
    Id: `a1RMOCKNOTE0000${n}AA`, Body__c: body, Author_Name__c: author, Author_Role__c: role, Source__c: source,
    Written_At__c: at, Parent_Lead__c: null, Parent_Contact__c: null, Parent_Account__c: null, Parent_Opportunity__c: null,
    ...parent,
  };
}

const INITIAL_NOTES: FakeNote[] = [
  note(1, { Parent_Lead__c: '00QMOCKLEAD00002AA' }, 'Test LO', 'Loan Officer', 'Salesforce', '2026-11-01T15:00:00.000Z',
    'Pre-approval letter is out, she can start showing.'),
  note(2, { Parent_Contact__c: JANE_CONTACT_ID }, 'Test Agent', 'Realtor', 'Lead Lens', '2026-11-03T18:30:00.000Z',
    'Saw two houses on Saturday, wants a third visit.'),
  note(3, { Parent_Opportunity__c: '006MOCKOPPT00003AA' }, 'Test LO', 'Loan Officer', 'Salesforce', '2026-10-28T14:00:00.000Z',
    'Appraisal ordered.'),
  note(4, { Parent_Lead__c: '00QMOCKLEAD00006AA' }, 'Other Agent', 'Realtor', 'Lead Lens', '2026-11-02T12:00:00.000Z',
    'Not yours to read.'),
];

let fakeNotes: FakeNote[] = INITIAL_NOTES.map(n => ({ ...n }));

export function resetMockNotes() {
  fakeNotes = INITIAL_NOTES.map(n => ({ ...n }));
  mockWrites.length = 0;
}

/** An insert. Only Realtor_Note__c is known; the stored note keeps only real note fields. */
export function mockCreateRecord(sobject: string, body: Record<string, unknown>): string {
  const id = sobject === 'Realtor_Note__c' ? `a1RMOCKNOTE${String(fakeNotes.length + 1).padStart(4, '0')}NEW` : '';
  mockWrites.push({ sobject, id, body: { ...body } });
  if (!id) throw new Error(`Mock insert failed: 404 ${sobject}`);
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  fakeNotes.push({
    Id: id, Body__c: str(body.Body__c) ?? '', Author_Name__c: str(body.Author_Name__c) ?? '',
    Author_Role__c: str(body.Author_Role__c) ?? '', Source__c: str(body.Source__c) ?? '',
    // Written_At__c defaults to NOW() in lgc-ci
    Written_At__c: new Date().toISOString(),
    Parent_Lead__c: str(body.Parent_Lead__c), Parent_Contact__c: str(body.Parent_Contact__c),
    Parent_Account__c: str(body.Parent_Account__c), Parent_Opportunity__c: str(body.Parent_Opportunity__c),
  });
  return id;
}

const NOTE_PARENTS = ['Parent_Lead__c', 'Parent_Contact__c', 'Parent_Account__c', 'Parent_Opportunity__c'] as const;

function mockNoteQuery(soql: string) {
  const wanted = NOTE_PARENTS.map(field => {
    const m = soql.match(new RegExp(`${field} IN \\(([^)]+)\\)`));
    return [field, m ? m[1].split(',').map(s => s.trim().replace(/'/g, '')) : []] as const;
  });
  const notes = fakeNotes
    .filter(n => wanted.some(([field, ids]) => n[field] !== null && ids.includes(n[field] as string)))
    .sort((a, b) => (b.Written_At__c ?? '').localeCompare(a.Written_At__c ?? '') || b.Id.localeCompare(a.Id));
  // Only the selected fields, like the real API
  const fields = soql.match(/SELECT (.+?) FROM/)![1].split(',').map(f => f.trim()) as (keyof FakeNote)[];
  const records = notes.map(n => ({
    attributes: { type: 'Realtor_Note__c', url: `/services/data/v62.0/sobjects/Realtor_Note__c/${n.Id}` },
    ...Object.fromEntries(fields.map(f => [f, n[f]])),
  }));
  return { totalSize: records.length, done: true, records };
}

export function mockExecuteSoql<T = Record<string, unknown>>(soql: string): SFQueryResponse<T> {
  if (/FROM Contact\b/.test(soql)) return mockContactQuery(soql) as unknown as SFQueryResponse<T>;
  if (/FROM Task\b/.test(soql)) return mockTaskQuery(soql) as unknown as SFQueryResponse<T>;
  if (/FROM Realtor_Note__c\b/.test(soql)) return mockNoteQuery(soql) as unknown as SFQueryResponse<T>;
  let rows = [...FAKE_ROWS];

  // Scope - the builder always puts the Lead__r side first
  const agent = soql.match(/Lead__r\.Referred_By__c = '([^']+)'/);
  if (agent) rows = rows.filter(r => r.referredById === agent[1]);
  const owner = soql.match(/Lead__r\.OwnerId = '([^']+)'/);
  if (owner) rows = rows.filter(r => r.ownerId === owner[1]);
  // One borrower row by its Lead or Contact Id (the notes scope check)
  const one = soql.match(/\(Lead__c = '([^']+)' OR Contact__c = '([^']+)'\)/);
  if (one) rows = rows.filter(r => r.Lead__c === one[1] || r.Contact__c === one[1]);
  // Several borrower rows by Id (the open-tasks scope check)
  const many = soql.match(/Lead__c IN \(([^)]+)\)/);
  if (many) {
    const ids = many[1].split(',').map(s => s.trim().replace(/'/g, ''));
    rows = rows.filter(r => ids.includes(r.Lead__c ?? '') || ids.includes(r.Contact__c ?? ''));
  }

  if (soql.includes('Lead__c = null')) rows = rows.filter(r => !r.Lead__c);
  const status = soql.match(/Status__c = '([^']+)'/);
  if (status) rows = rows.filter(r => r.Lead__c && r.Status__c === status[1]);
  const temp = soql.match(/Temperature__c = '([^']+)'/);
  if (temp) rows = rows.filter(r => r.Temperature__c === temp[1]);
  const like = soql.match(/First_name__c LIKE '%([^%]+)%'/);
  if (like) {
    const s = like[1].toLowerCase();
    rows = rows.filter(r => `${r.First_name__c} ${r.Last_Name__c}`.toLowerCase().includes(s));
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
