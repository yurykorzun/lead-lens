import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

process.env.MOCK_SALESFORCE = 'true';
process.env.APP_JWT_SECRET = 'test-secret';

// An in-memory notes table: enough of the Drizzle chain for the two note routes
type Row = { id: string; sfRecordId: string; authorId: string | null; authorName: string; authorRole: string; body: string; createdAt: Date };
const table: Row[] = [];
vi.mock('../db/index.js', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: async () => [...table].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .filter(r => r.sfRecordId === lastRecordId),
        }),
      }),
    }),
    insert: () => ({
      values: (v: Omit<Row, 'id' | 'createdAt'>) => ({
        returning: async () => {
          const row = { ...v, id: `n${table.length + 1}`, createdAt: new Date(Date.now() + table.length) };
          table.push(row);
          return [row];
        },
      }),
    }),
  }),
}));
// The fake select cannot read the Drizzle where clause, so the route's record Id is captured here
let lastRecordId = '';

const { default: app } = await import('../app.js');
const { createSessionToken } = await import('../services/auth.js');
const { MOCK_AGENT_CONTACT_ID, MOCK_LO_USER_ID } = await import('../services/salesforce/mock.js');

const agent = createSessionToken('u-agent', 'agent', 'Test Agent', undefined, undefined, MOCK_AGENT_CONTACT_ID);
const otherAgent = createSessionToken('u-other', 'agent', 'Other Agent', undefined, undefined, '003MOCKAGENT0002AA');
const unlinked = createSessionToken('u-new', 'agent', 'New Agent');
const lo = createSessionToken('u-lo', 'loan_officer', 'Test LO', undefined, undefined, MOCK_LO_USER_ID);
const admin = createSessionToken('u-admin', 'admin', 'Test Admin');

// Lead 1 (John Smith) is referred by the test agent and owned by the test LO
const MINE = '00QMOCKLEAD00001AA';
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
beforeEach(() => { table.length = 0; });

function call(method: string, recordId: string, token: string, body?: unknown) {
  lastRecordId = recordId;
  return fetch(`${base}/contacts/${recordId}/notes`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('notes on a borrower', () => {
  it('the realtor adds a note and everyone who sees the borrower reads it', async () => {
    const res = await call('POST', MINE, agent, { body: '  Called her, pre-approval next week  ' });
    expect(res.status).toBe(200);
    const saved = (await res.json() as { data: { body: string; authorName: string; mine: boolean } }).data;
    expect(saved).toMatchObject({ body: 'Called her, pre-approval next week', authorName: 'Test Agent', mine: true });

    for (const [token, mine] of [[agent, true], [lo, false], [admin, false]] as const) {
      const list = await call('GET', MINE, token);
      expect(list.status).toBe(200);
      const items = (await list.json() as { data: { body: string; mine: boolean; authorRole: string }[] }).data;
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ authorRole: 'agent', mine });
    }
  });

  it('nobody reads or writes notes on a borrower outside their dashboard', async () => {
    expect((await call('GET', NOT_MINE, agent)).status).toBe(404);
    expect((await call('POST', NOT_MINE, agent, { body: 'x' })).status).toBe(404);
    expect((await call('POST', MINE, otherAgent, { body: 'x' })).status).toBe(404);
    expect(table).toHaveLength(0);
  });

  it('an unlinked agent gets no notes at all', async () => {
    expect((await call('GET', MINE, unlinked)).status).toBe(403);
  });

  it('refuses an empty or oversized note and a malformed Id', async () => {
    expect((await call('POST', MINE, agent, { body: '   ' })).status).toBe(400);
    expect((await call('POST', MINE, agent, { body: 'x'.repeat(2001) })).status).toBe(400);
    expect((await call('GET', "00Q' OR Id != '", admin)).status).toBe(404);
    expect(table).toHaveLength(0);
  });

  it('lists the newest note first', async () => {
    await call('POST', MINE, agent, { body: 'first' });
    await call('POST', MINE, lo, { body: 'second' });
    const items = (await (await call('GET', MINE, admin)).json() as { data: { body: string }[] }).data;
    expect(items.map(n => n.body)).toEqual(['second', 'first']);
  });
});
