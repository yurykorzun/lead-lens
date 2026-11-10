import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import type { ContactNote, ContactRow, RealtorStageState } from '@lead-lens/shared';

process.env.MOCK_SALESFORCE = 'true';
process.env.APP_JWT_SECRET = 'test-secret';

const { default: app } = await import('../app.js');
const { createSessionToken } = await import('../services/auth.js');
const { MOCK_AGENT_CONTACT_ID, MOCK_LO_USER_ID, mockWrites, resetMockNotes } = await import('../services/salesforce/mock.js');
const { buildNotesQuery, buildStageQuery, buildNoteInsert } = await import('../services/salesforce/realtor-notes.js');
const { tracksStage } = await import('../routes/contacts.js');
const { mapRow } = await import('../services/salesforce/query.js');

const agent = createSessionToken('u-agent', 'agent', 'Test Agent', undefined, undefined, MOCK_AGENT_CONTACT_ID);
const otherAgent = createSessionToken('u-other', 'agent', 'Other Agent', undefined, undefined, '003MOCKAGENT0002AA');
const lo = createSessionToken('u-lo', 'loan_officer', 'Test LO', undefined, undefined, MOCK_LO_USER_ID);
const admin = createSessionToken('u-admin', 'admin', 'Test Admin');

// John Smith (lead 1): the test agent's, no stage yet
const JOHN = '00QMOCKLEAD00001AA';
// David Lee (client 4): the test agent set Touring Homes
const DAVID = '003MOCKCLNT00004AA';
const DAVID_ACCOUNT = '001MOCKACCT00004AA';
// Lead 6: the other agent's
const NOT_MINE = '00QMOCKLEAD00006AA';

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => { server.close(); });
beforeEach(() => { process.env.REALTOR_STAGE = 'true'; resetMockNotes(); });
afterEach(() => { delete process.env.REALTOR_STAGE; });

function call(method: string, recordId: string, token: string, body?: unknown, query = '') {
  return fetch(`${base}/contacts/${recordId}/stage${query}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function stageOf(recordId: string, token: string): Promise<RealtorStageState> {
  const res = await call('GET', recordId, token);
  expect(res.status).toBe(200);
  return (await res.json() as { data: RealtorStageState }).data;
}

describe('realtor stage', () => {
  it('the realtor sets a stage: one note insert with only the allowlisted fields', async () => {
    const res = await call('POST', JOHN, agent, {
      stage: 'Touring Homes',
      // None of these may reach Salesforce
      Body__c: 'smuggled', Stage__c: 'Closed', Parent_Lead__c: NOT_MINE, Author_Name__c: 'Leon Belov', Source__c: 'Salesforce',
    });
    expect(res.status).toBe(200);
    expect((await res.json() as { data: RealtorStageState }).data).toMatchObject({ enabled: true, stage: 'Touring Homes', setBy: 'Test Agent' });
    expect(mockWrites).toHaveLength(1);
    expect(mockWrites[0].sobject).toBe('Realtor_Note__c');
    expect(mockWrites[0].body).toEqual({
      Body__c: 'Stage: Touring Homes',
      Parent_Lead__c: JOHN,
      Author_Name__c: 'Test Agent',
      Author_Role__c: 'Realtor',
      Source__c: 'Lead Lens',
      Stage__c: 'Touring Homes',
    });
    // The loan officer and admins read it
    for (const token of [agent, lo, admin]) expect(await stageOf(JOHN, token)).toMatchObject({ stage: 'Touring Homes' });
  });

  it('a client stage is parented to the Contact and the person account, like a note', async () => {
    expect((await call('POST', DAVID, agent, { stage: 'Making Offers' })).status).toBe(200);
    expect(mockWrites[0].body).toMatchObject({ Parent_Contact__c: DAVID, Parent_Account__c: DAVID_ACCOUNT, Stage__c: 'Making Offers' });
    expect(await stageOf(DAVID, lo)).toMatchObject({ stage: 'Making Offers', setBy: 'Test Agent' });
  });

  it('shows the newest stage, and the same stage again writes nothing', async () => {
    expect(await stageOf(DAVID, agent)).toMatchObject({ enabled: true, stage: 'Touring Homes', setBy: 'Test Agent' });
    const res = await call('POST', DAVID, agent, { stage: 'Touring Homes' });
    expect(res.status).toBe(200);
    expect(mockWrites).toHaveLength(0);
  });

  it('On Hold keeps the last stage she reached as pausedAt', async () => {
    expect((await call('POST', DAVID, agent, { stage: 'Making Offers' })).status).toBe(200);
    const hold = await call('POST', DAVID, agent, { stage: 'On Hold' });
    expect((await hold.json() as { data: RealtorStageState }).data).toMatchObject({ stage: 'On Hold', pausedAt: 'Making Offers' });
    expect(await stageOf(DAVID, agent)).toMatchObject({ stage: 'On Hold', pausedAt: 'Making Offers' });
    expect((await call('POST', DAVID, agent, { stage: 'Under Contract' })).status).toBe(200);
    expect((await stageOf(DAVID, agent)).pausedAt).toBeUndefined();
  });

  it('a stage change shows in the notes thread, marked with its stage', async () => {
    const res = await fetch(`${base}/contacts/${DAVID}/notes`, { headers: { Authorization: `Bearer ${lo}` } });
    const notes = (await res.json() as { data: ContactNote[] }).data;
    expect(notes.find(n => n.body === 'Stage: Touring Homes')).toMatchObject({ stage: 'Touring Homes', source: 'Lead Lens' });
  });

  it('no stage yet reads as enabled with none', async () => {
    expect(await stageOf(JOHN, agent)).toEqual({ enabled: true });
  });

  it('refuses anything but a listed stage', async () => {
    for (const stage of ['Closed', 'Initial Contact', '', null, 7, 'touring homes']) {
      expect((await call('POST', JOHN, agent, { stage })).status).toBe(400);
    }
    expect(mockWrites).toHaveLength(0);
  });

  it('only the realtor sets it, and only on her own borrowers', async () => {
    expect((await call('POST', JOHN, lo, { stage: 'Funded' })).status).toBe(403);
    expect((await call('POST', JOHN, admin, { stage: 'Funded' })).status).toBe(403);
    expect((await call('POST', JOHN, admin, { stage: 'Funded' }, `?viewAs=agent:${MOCK_AGENT_CONTACT_ID}`)).status).toBe(403);
    expect((await call('POST', NOT_MINE, agent, { stage: 'Funded' })).status).toBe(404);
    expect((await call('GET', NOT_MINE, agent)).status).toBe(404);
    expect((await call('POST', JOHN, otherAgent, { stage: 'Funded' })).status).toBe(404);
    expect(mockWrites).toHaveLength(0);
  });

  it('turned off, nothing names Stage__c and nothing is written', async () => {
    delete process.env.REALTOR_STAGE;
    expect(await stageOf(DAVID, agent)).toEqual({ enabled: false });
    expect((await call('POST', JOHN, agent, { stage: 'Funded' })).status).toBe(404);
    expect(mockWrites).toHaveLength(0);
    const ids = { leadIds: [JOHN], contactIds: [], accountIds: [], opportunityIds: [] };
    expect(buildNotesQuery(ids)).not.toContain('Stage__c');
    expect(() => buildNoteInsert(JOHN, 'x', { name: 'A', role: 'agent' }, undefined, 'Funded')).toThrow('Invalid stage');
    // A plain note never carries Stage__c
    expect(buildNoteInsert(JOHN, 'x', { name: 'A', role: 'agent' })).not.toHaveProperty('Stage__c');
  });

  it('the stage query reads only the stage fields, from the same parents as the notes', () => {
    const ids = { leadIds: [JOHN], contactIds: [DAVID], accountIds: [DAVID_ACCOUNT], opportunityIds: [] };
    const q = buildStageQuery(ids)!;
    expect(q).toMatch(/^SELECT Id, Stage__c, Author_Name__c, Written_At__c FROM Realtor_Note__c WHERE Stage__c != null AND \(/);
    expect(q).toContain(`Parent_Lead__c IN ('${JOHN}')`);
    expect(q).toContain(`Parent_Contact__c IN ('${DAVID}')`);
    expect(q).toMatch(/ORDER BY Written_At__c DESC NULLS LAST, Id DESC LIMIT 1$/);
    expect(q).not.toMatch(/Body__c|Rep_Notes|Message_to_Realtor|Description/);
  });
});

describe('whose stage it is', () => {
  const none = { leadIds: [], contactIds: [], accountIds: [], opportunityIds: [] };
  const realtor = { role: 'agent' as const, contactId: MOCK_AGENT_CONTACT_ID };

  it("a client's stage is her realtor's, not the realtor of a later loan", () => {
    // The client's Referred By: idsFromRows gives her the person account
    expect(tracksStage(realtor, DAVID, { ...none, contactIds: [DAVID], accountIds: [DAVID_ACCOUNT] })).toBe(true);
    // Only a second loan is hers: the shared Contact thread, no account
    expect(tracksStage(realtor, DAVID, { ...none, contactIds: [DAVID], opportunityIds: ['006MOCKOPPT00004AA'] })).toBe(false);
    // A lead is only in her scope as its Referred By
    expect(tracksStage(realtor, JOHN, { ...none, leadIds: [JOHN] })).toBe(true);
    // Staff read every stage
    expect(tracksStage({ role: 'loan_officer', userId: MOCK_LO_USER_ID }, DAVID, { ...none, contactIds: [DAVID] })).toBe(true);
    expect(tracksStage({ role: 'admin' }, DAVID, none)).toBe(true);
  });
});

describe('loan officer contact on the row', () => {
  it('a queue-owned lead gives the realtor no email or phone to reach', () => {
    const row = mapRow({
      Lead__c: JOHN, First_name__c: 'A', Last_Name__c: 'B',
      Lead__r: { Email: 'b@x.com', Owner: { Name: 'Web Leads', Type: 'Queue', Email: 'queue@x.com', Phone: '5551112222' } },
    });
    expect(row).toMatchObject({ ownerName: 'Web Leads' });
    expect(row.ownerEmail).toBeUndefined();
    expect(row.ownerPhone).toBeUndefined();
  });

  it('the realtor gets her LO name, email and phone from the owner', async () => {
    const res = await fetch(`${base}/contacts`, { headers: { Authorization: `Bearer ${agent}` } });
    const rows = (await res.json() as { data: ContactRow[] }).data;
    expect(rows.find(r => r.id === JOHN)).toMatchObject({ ownerName: 'Test LO', ownerEmail: 'lo@test.com', ownerPhone: '(555) 200-0001' });
    // An LO with no phone in Salesforce has none here
    expect(rows.find(r => r.name === 'Alex Kim')).toMatchObject({ ownerName: 'Other LO', ownerEmail: 'other.lo@test.com' });
    expect(rows.find(r => r.name === 'Alex Kim')?.ownerPhone).toBeUndefined();
  });
});
