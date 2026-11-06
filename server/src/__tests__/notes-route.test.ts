import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import type { ContactNote } from '@lead-lens/shared';

process.env.MOCK_SALESFORCE = 'true';
process.env.APP_JWT_SECRET = 'test-secret';

// The old Lead Lens notes table was copied to Realtor_Note__c (lendinggroupco-uhnx.12.4), so
// the notes routes must not touch the database at all: any read or write fails the test.
let dbTouched = false;
vi.mock('../db/index.js', () => ({
  getDb: () => {
    dbTouched = true;
    throw new Error('the notes routes must not use the Lead Lens database any more');
  },
}));

const { default: app } = await import('../app.js');
const { createSessionToken } = await import('../services/auth.js');
const { MOCK_AGENT_CONTACT_ID, MOCK_LO_USER_ID, mockWrites, resetMockNotes } = await import('../services/salesforce/mock.js');
const { buildNotesQuery, buildNoteInsert, NOTE_FIELDS } = await import('../services/salesforce/realtor-notes.js');
const { idsFromRows } = await import('../services/salesforce/query.js');

const agent = createSessionToken('u-agent', 'agent', 'Test Agent', undefined, undefined, MOCK_AGENT_CONTACT_ID);
const otherAgent = createSessionToken('u-other', 'agent', 'Other Agent', undefined, undefined, '003MOCKAGENT0002AA');
const unlinked = createSessionToken('u-new', 'agent', 'New Agent');
const lo = createSessionToken('u-lo', 'loan_officer', 'Test LO', undefined, undefined, MOCK_LO_USER_ID);
const admin = createSessionToken('u-admin', 'admin', 'Test Admin');

// Lead 1 (John Smith) is referred by the test agent and owned by the test LO, no notes yet
const MINE = '00QMOCKLEAD00001AA';
// Lead 2 (Jane Doe) has both a Lead and a Contact Id on her row, with a note on each
const JANE_LEAD = '00QMOCKLEAD00002AA';
const JANE_CONTACT = '003MOCKCONV00002AA';
// Lead 6 belongs to the other agent and the other LO
const NOT_MINE = '00QMOCKLEAD00006AA';

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => { server.close(); });
beforeEach(() => { dbTouched = false; resetMockNotes(); });

function call(method: string, recordId: string, token: string, body?: unknown) {
  return fetch(`${base}/contacts/${recordId}/notes`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function list(recordId: string, token: string): Promise<ContactNote[]> {
  const res = await call('GET', recordId, token);
  expect(res.status).toBe(200);
  return (await res.json() as { data: ContactNote[] }).data;
}

describe('notes on a borrower (Realtor_Note__c)', () => {
  it('an agent note is one insert with only the allowlisted fields, whatever the request carries', async () => {
    const res = await call('POST', MINE, agent, {
      body: '  Called her, pre-approval next week  ',
      // None of these may reach Salesforce
      Body__c: 'smuggled', Parent_Account__c: '001MOCKACCT00003AA', Parent_Lead__c: NOT_MINE,
      Author_Name__c: 'Leon Belov', Author_Role__c: 'Admin', Source__c: 'Salesforce',
      Rep_Notes__c: 'internal', OwnerId: MOCK_LO_USER_ID, Id: 'a1RMOCKNOTE00001AA',
    });
    expect(res.status).toBe(200);
    const saved = (await res.json() as { data: ContactNote }).data;
    expect(saved).toMatchObject({ body: 'Called her, pre-approval next week', authorName: 'Test Agent', authorRole: 'agent', source: 'Lead Lens', mine: true });

    expect(mockWrites).toHaveLength(1);
    expect(mockWrites[0].sobject).toBe('Realtor_Note__c');
    expect(mockWrites[0].body).toEqual({
      Body__c: 'Called her, pre-approval next week',
      Parent_Lead__c: MINE,
      Author_Name__c: 'Test Agent',
      Author_Role__c: 'Realtor',
      Source__c: 'Lead Lens',
    });

    for (const token of [agent, lo, admin]) {
      const items = await list(MINE, token);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: saved.id, authorName: 'Test Agent', authorRole: 'agent', source: 'Lead Lens', mine: false });
    }
  });

  it('never labels a note "mine" by name, because two users can share a name', async () => {
    const alex1 = createSessionToken('u-alex1', 'admin', 'Alex Smith');
    const alex2 = createSessionToken('u-alex2', 'admin', 'Alex Smith');
    expect((await call('POST', MINE, alex1, { body: 'from the first Alex' })).status).toBe(200);
    const items = await list(MINE, alex2);
    expect(items[0]).toMatchObject({ body: 'from the first Alex', authorName: 'Alex Smith', mine: false });
  });

  it('an admin viewing as a realtor reads her notes but cannot add one', async () => {
    const asAgent = `viewAs=agent:${MOCK_AGENT_CONTACT_ID}`;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` };
    const read = await fetch(`${base}/contacts/${JANE_LEAD}/notes?${asAgent}`, { headers });
    expect(read.status).toBe(200);
    // Her scope, not the admin's: a borrower outside her dashboard is 404
    expect((await fetch(`${base}/contacts/${NOT_MINE}/notes?${asAgent}`, { headers })).status).toBe(404);

    const write = await fetch(`${base}/contacts/${MINE}/notes?${asAgent}`, { method: 'POST', headers, body: JSON.stringify({ body: 'hi' }) });
    expect(write.status).toBe(403);
    expect(mockWrites).toHaveLength(0);
  });

  it('a note on a client row is parented by her Contact and her person account', async () => {
    // The person account page lists Realtor Notes by Account Id, so without it the LO never sees the note
    expect((await call('POST', '003MOCKCLNT00003AA', lo, { body: 'Docs in', Parent_Account__c: '001MOCKACCT00009AA' })).status).toBe(200);
    expect(mockWrites[0].body).toEqual({
      Body__c: 'Docs in', Parent_Contact__c: '003MOCKCLNT00003AA', Parent_Account__c: '001MOCKACCT00003AA',
      Author_Name__c: 'Test LO', Author_Role__c: 'Loan Officer', Source__c: 'Lead Lens',
    });
  });

  it('nobody reads or writes notes on a borrower outside their dashboard', async () => {
    expect((await call('GET', NOT_MINE, agent)).status).toBe(404);
    expect((await call('POST', NOT_MINE, agent, { body: 'x' })).status).toBe(404);
    expect((await call('GET', MINE, otherAgent)).status).toBe(404);
    expect((await call('POST', MINE, otherAgent, { body: 'x' })).status).toBe(404);
    expect((await call('GET', NOT_MINE, lo)).status).toBe(404);
    expect((await call('POST', NOT_MINE, lo, { body: 'x' })).status).toBe(404);
    expect(mockWrites).toHaveLength(0);
  });

  it('finds notes parented to either the Lead or the Contact on the row', async () => {
    for (const id of [JANE_LEAD, JANE_CONTACT]) {
      const items = await list(id, agent);
      expect(items.map(n => n.body)).toEqual([
        'Saw two houses on Saturday, wants a third visit.',
        'Pre-approval letter is out, she can start showing.',
      ]);
      expect(items[0]).toMatchObject({ authorName: 'Test Agent', authorRole: 'agent', source: 'Lead Lens', mine: false });
      expect(items[1]).toMatchObject({ authorName: 'Test LO', authorRole: 'loan_officer', source: 'Salesforce', mine: false });
    }
  });

  it('finds the LO notes on the person account and the first loan, which the tracker row does not name', async () => {
    // lgc-ci leaves LeadAccount__c.Account__c empty on client rows, and only a second loan
    // has its own row, so both are reached through Contact__r.AccountId
    const items = await list('003MOCKCLNT00003AA', admin);
    expect(items.map(n => n.body)).toEqual(['Rate lock runs to the 20th.', 'Appraisal ordered.']);
    // Her realtor (the client's Referred By) reads the same two
    expect((await list('003MOCKCLNT00003AA', agent)).map(n => n.body)).toEqual(['Rate lock runs to the 20th.', 'Appraisal ordered.']);
  });

  it('returns only the note fields Lead Lens selects', async () => {
    const items = await list(JANE_LEAD, lo);
    for (const n of items) {
      expect(Object.keys(n).sort()).toEqual(['authorName', 'authorRole', 'body', 'createdAt', 'id', 'mine', 'source']);
    }
  });

  it('reads and writes notes only in Salesforce, never the old Lead Lens table', async () => {
    await call('POST', MINE, lo, { body: 'new in Salesforce' });
    const items = await list(MINE, agent);
    expect(items.map(n => n.body)).toContain('new in Salesforce');
    expect(dbTouched).toBe(false);
  });

  it('an unlinked agent gets no notes at all', async () => {
    expect((await call('GET', MINE, unlinked)).status).toBe(403);
    expect((await call('POST', MINE, unlinked, { body: 'x' })).status).toBe(403);
    expect(mockWrites).toHaveLength(0);
  });

  it('refuses an empty or oversized note and a malformed Id', async () => {
    expect((await call('POST', MINE, agent, { body: '   ' })).status).toBe(400);
    expect((await call('POST', MINE, agent, { body: 'x'.repeat(2001) })).status).toBe(400);
    expect((await call('POST', MINE, agent, { Body__c: 'only the wrong key' })).status).toBe(400);
    expect((await call('GET', "00Q' OR Id != '", admin)).status).toBe(404);
    expect(mockWrites).toHaveLength(0);
  });
});

describe('Realtor_Note__c SOQL and insert body', () => {
  const ids = { leadIds: [JANE_LEAD], contactIds: [JANE_CONTACT], accountIds: ['001MOCKACCT00002AA'], opportunityIds: ['006MOCKOPPT00003AA'] };

  it('selects only the note fields, never the team notes', () => {
    const q = buildNotesQuery(ids)!;
    expect(q.match(/^SELECT (.+?) FROM Realtor_Note__c /)![1]).toBe(NOTE_FIELDS);
    expect(NOTE_FIELDS.split(', ')).toEqual(['Id', 'Body__c', 'Author_Name__c', 'Author_Role__c', 'Source__c', 'Written_At__c']);
    expect(q).not.toMatch(/Rep_Notes|Message_to_Realtor|Description|Note_History|\bTask\b/i);
  });

  it('looks up every parent Id on the row', () => {
    const q = buildNotesQuery(ids)!;
    expect(q).toContain(`Parent_Lead__c IN ('${JANE_LEAD}')`);
    expect(q).toContain(`Parent_Contact__c IN ('${JANE_CONTACT}')`);
    expect(q).toContain("Parent_Account__c IN ('001MOCKACCT00002AA')");
    expect(q).toContain("Parent_Opportunity__c IN ('006MOCKOPPT00003AA')");
    expect(q).toContain("(Parent_Opportunity__r.AccountId IN ('001MOCKACCT00002AA'))");
    expect(buildNotesQuery({ leadIds: [], contactIds: [], accountIds: [], opportunityIds: [] })).toBeNull();
    expect(() => buildNotesQuery({ ...ids, leadIds: ["x' OR Id != '"] })).toThrow();
  });

  it('a realtor reads only the loans she referred on the account, and a bad realtor Id never reaches SOQL', () => {
    const q = buildNotesQuery({ ...ids, loanRealtorId: MOCK_AGENT_CONTACT_ID })!;
    expect(q).toContain(`(Parent_Opportunity__r.AccountId IN ('001MOCKACCT00002AA') AND (Parent_Opportunity__r.Referring_Agent__c = '${MOCK_AGENT_CONTACT_ID}' OR Parent_Opportunity__r.Referring_Agent__c = null))`);
    expect(() => buildNotesQuery({ ...ids, loanRealtorId: "x' OR Id != '" })).toThrow();
  });

  it('a realtor who sees the client only through a later loan gets that loan, not the person account', () => {
    const SECOND_LOAN_REALTOR = '003MOCKAGENT0002AA';
    const rows = [
      // The client's own row, referred by the test agent
      { Lead__c: null, Contact__c: '003MOCKCLNT00003AA', Account__c: null, Opportunity__c: null,
        Contact__r: { AccountId: '001MOCKACCT00003AA', Referred_By__c: MOCK_AGENT_CONTACT_ID } },
      // Her second loan, referred by another realtor
      { Lead__c: null, Contact__c: '003MOCKCLNT00003AA', Account__c: null, Opportunity__c: '006MOCKOPPT00009AA',
        Contact__r: { AccountId: '001MOCKACCT00003AA', Referred_By__c: MOCK_AGENT_CONTACT_ID } },
    ];
    const second = idsFromRows({ role: 'agent', contactId: SECOND_LOAN_REALTOR }, rows.slice(1));
    expect(second).toEqual({
      leadIds: [], contactIds: ['003MOCKCLNT00003AA'], accountIds: [], opportunityIds: ['006MOCKOPPT00009AA'],
      loanRealtorId: SECOND_LOAN_REALTOR,
    });
    expect(idsFromRows({ role: 'agent', contactId: MOCK_AGENT_CONTACT_ID }, rows).accountIds).toEqual(['001MOCKACCT00003AA']);
    // The LO and admins are staff and read the whole account, as in Salesforce
    const staff = idsFromRows({ role: 'loan_officer', userId: MOCK_LO_USER_ID }, rows.slice(1));
    expect(staff.accountIds).toEqual(['001MOCKACCT00003AA']);
    expect(staff.loanRealtorId).toBeUndefined();
  });

  it('refuses a parent that is not a Lead or Contact, and an unknown role', () => {
    expect(() => buildNoteInsert('001MOCKACCT00002AA', 'x', { name: 'A', role: 'agent' })).toThrow();
    expect(() => buildNoteInsert(MINE, 'x', { name: 'A', role: 'superuser' })).toThrow();
    expect(buildNoteInsert(MINE, 'x', { name: 'A'.repeat(300), role: 'admin' }).Author_Name__c).toHaveLength(255);
  });
});
