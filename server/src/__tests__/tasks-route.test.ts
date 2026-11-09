import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import type { RealtorTask } from '@lead-lens/shared';

process.env.MOCK_SALESFORCE = 'true';
process.env.APP_JWT_SECRET = 'test-secret';

const { default: app } = await import('../app.js');
const { createSessionToken } = await import('../services/auth.js');
const mock = await import('../services/salesforce/mock.js');
const { MOCK_AGENT_CONTACT_ID, MOCK_LO_USER_ID, mockWrites, resetMockTasks } = mock;

const agent = createSessionToken('u-agent', 'agent', 'Test Agent', undefined, undefined, MOCK_AGENT_CONTACT_ID);
const otherAgent = createSessionToken('u-other', 'agent', 'Other Agent', undefined, undefined, '003MOCKAGENT0002AA');
const unlinked = createSessionToken('u-new', 'agent', 'New Agent');
const lo = createSessionToken('u-lo', 'loan_officer', 'Test LO', undefined, undefined, MOCK_LO_USER_ID);
const admin = createSessionToken('u-admin', 'admin', 'Test Admin');

// Lead 1 (John Smith): referred by the test agent, owned by the test LO
const MINE = '00QMOCKLEAD00001AA';
// Lead 6: the other agent's borrower
const NOT_MINE = '00QMOCKLEAD00006AA';
// The mock's task Ids (see mock.ts FAKE_TASKS)
const CALL_1 = '00TMOCKTASK00001AA';
const CALL_2 = '00TMOCKTASK00002AA';
const LP_TASK = '00TMOCKTASK00004AA';
const OTHER_REALTOR_TASK = '00TMOCKTASK00005AA';

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => { server.close(); });
beforeEach(() => { resetMockTasks(); });

function call(method: string, path: string, token: string, body?: unknown) {
  return fetch(`${base}/contacts${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function list(token: string, recordId = MINE) {
  const res = await call('GET', `/${recordId}/tasks`, token);
  return { status: res.status, data: res.ok ? (await res.json() as { data: RealtorTask[] }).data : [] };
}

describe('realtor tasks on a borrower', () => {
  it('the realtor sees her own set, earliest due first, and never the LP tasks', async () => {
    const { status, data } = await list(agent);
    expect(status).toBe(200);
    expect(data.map(t => t.subject)).toEqual(['Realtor: Call 1', 'Realtor: Call 2', 'Realtor: Showing 1']);
    expect(data.every(t => t.canComplete)).toBe(true);
    expect(data.map(t => t.id)).not.toContain(LP_TASK);
    expect(data.map(t => t.id)).not.toContain(OTHER_REALTOR_TASK);
  });

  it('the LO and admin see the realtor tasks read-only', async () => {
    for (const token of [lo, admin]) {
      const { status, data } = await list(token);
      expect(status).toBe(200);
      expect(data.map(t => t.id)).toContain(CALL_1);
      expect(data.map(t => t.id)).not.toContain(LP_TASK);
      expect(data.every(t => !t.canComplete)).toBe(true);
    }
  });

  it('no task fields that carry notes come back', async () => {
    const res = await call('GET', `/${MINE}/tasks`, agent);
    const raw = JSON.stringify(await res.json());
    expect(raw).not.toMatch(/Description|description|Message_to_Realtor/);
  });

  it('a borrower outside her dashboard is 404, an unlinked realtor is 403', async () => {
    expect((await list(agent, NOT_MINE)).status).toBe(404);
    expect((await list(otherAgent, MINE)).status).toBe(404);
    expect((await list(unlinked)).status).toBe(403);
    expect((await list(admin, "00Q' OR Id != '")).status).toBe(404);
  });
});

describe('completing a realtor task', () => {
  it('marks it Completed in Salesforce and sends Status and nothing else', async () => {
    const res = await call('POST', `/${MINE}/tasks/${CALL_1}/complete`, agent, {
      // Anything else in the body is ignored, never forwarded
      Description: 'x', Update_Referred_By_via_SMS__c: true, Update_Last_Touch__c: true,
    });
    expect(res.status).toBe(200);
    expect((await res.json() as { data: RealtorTask }).data).toMatchObject({ id: CALL_1, done: true, status: 'Completed' });
    expect(mockWrites).toEqual([{ sobject: 'Task', id: CALL_1, body: { Status: 'Completed' } }]);

    const { data } = await list(agent);
    expect(data.find(t => t.id === CALL_1)?.done).toBe(true);
  });

  it('completing a task that is already done writes nothing', async () => {
    await call('POST', `/${MINE}/tasks/${CALL_1}/complete`, agent);
    const again = await call('POST', `/${MINE}/tasks/${CALL_1}/complete`, agent);
    expect(again.status).toBe(200);
    expect(mockWrites).toHaveLength(1);
  });

  it('refuses the LP task, another realtor task, a task on another borrower, and non-realtors', async () => {
    expect((await call('POST', `/${MINE}/tasks/${LP_TASK}/complete`, agent)).status).toBe(404);
    expect((await call('POST', `/${MINE}/tasks/${OTHER_REALTOR_TASK}/complete`, agent)).status).toBe(404);
    // CALL_2 is on MINE, asked for through another borrower Id
    expect((await call('POST', `/${NOT_MINE}/tasks/${CALL_2}/complete`, agent)).status).toBe(404);
    expect((await call('POST', `/${MINE}/tasks/${CALL_1}/complete`, otherAgent)).status).toBe(404);
    expect((await call('POST', `/${MINE}/tasks/${CALL_1}/complete`, lo)).status).toBe(403);
    expect((await call('POST', `/${MINE}/tasks/${CALL_1}/complete`, admin)).status).toBe(403);
    expect((await call('POST', `/${MINE}/tasks/00T' OR Id != '/complete`, agent)).status).toBe(404);
    expect(mockWrites).toHaveLength(0);
  });
});

describe('open tasks across her borrowers', () => {
  it('lists only the next open step on each borrower, with the borrower name, earliest due first', async () => {
    const res = await call('GET', '/tasks/open', agent);
    expect(res.status).toBe(200);
    const data = (await res.json() as { data: RealtorTask[] }).data;
    // Lead 1 has Call 1, Call 2 and Showing 1 open - only Call 1 is listed
    expect(data.map(t => [t.borrowerId, t.subject])).toEqual([
      [MINE, 'Realtor: Call 1'],
      ['00QMOCKLEAD00002AA', 'Realtor: Call 1'],
    ]);
    expect(data[0]).toMatchObject({ id: CALL_1, borrowerName: 'John Smith' });
    expect(data.every(t => !t.done)).toBe(true);
  });

  it('shows the following step once she completes the current one', async () => {
    expect((await call('POST', `/${MINE}/tasks/${CALL_1}/complete`, agent)).status).toBe(200);
    const data = (await (await call('GET', '/tasks/open', agent)).json() as { data: RealtorTask[] }).data;
    expect(data.filter(t => t.borrowerId === MINE).map(t => t.id)).toEqual([CALL_2]);
  });

  it('drops a task whose borrower has left her dashboard', async () => {
    // Task 7 is hers but on lead 6, which is referred by the other agent now
    const data = (await (await call('GET', '/tasks/open', agent)).json() as { data: RealtorTask[] }).data;
    expect(data.map(t => t.id)).not.toContain('00TMOCKTASK00007AA');
  });

  it('is for realtors only', async () => {
    expect((await call('GET', '/tasks/open', lo)).status).toBe(403);
    expect((await call('GET', '/tasks/open', admin)).status).toBe(403);
    expect((await call('GET', '/tasks/open', unlinked)).status).toBe(403);
  });
});
