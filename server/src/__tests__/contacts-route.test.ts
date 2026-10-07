import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

process.env.MOCK_SALESFORCE = 'true';
process.env.APP_JWT_SECRET = 'test-secret';

// Real mock behaviour, but spied so a test can prove no SOQL was built
vi.mock('../services/salesforce/query.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/salesforce/query.js')>();
  return { ...actual, executeSoql: vi.fn(actual.executeSoql) };
});

const { default: app } = await import('../app.js');
const { createSessionToken } = await import('../services/auth.js');
const { executeSoql } = await import('../services/salesforce/query.js');
const { MOCK_AGENT_CONTACT_ID, MOCK_LO_USER_ID } = await import('../services/salesforce/mock.js');

const agent = createSessionToken('u-agent', 'agent', 'Test Agent', undefined, undefined, MOCK_AGENT_CONTACT_ID);
const unlinkedAgent = createSessionToken('u-agent2', 'agent', 'New Agent', 'MtgPlanner_CRM__Referred_By_Text__c', 'New Agent');
const lo = createSessionToken('u-lo', 'loan_officer', 'Test LO', undefined, undefined, MOCK_LO_USER_ID);
const admin = createSessionToken('u-admin', 'admin', 'Test Admin');

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.mocked(executeSoql).mockClear();
});

function get(path: string, token: string) {
  return fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

async function rows(res: Response) {
  return ((await res.json()) as { data: Record<string, unknown>[] }).data;
}

const FREE_TEXT_KEYS = ['message', 'description', 'lastTouch', 'lastTouchSms', 'notes', 'repNotes'];

describe('GET /api/contacts scope', () => {
  it('an agent sees only rows they referred', async () => {
    const res = await get('/contacts', agent);
    expect(res.status).toBe(200);
    const names = (await rows(res)).map(r => r.name).sort();
    expect(names).toEqual(['Alex Kim', 'David Lee', 'Jane Doe', 'John Smith', 'Maria Garcia', 'Olga Petrova']);
  });

  it('a loan officer sees only rows they own', async () => {
    const names = (await rows(await get('/contacts', lo))).map(r => r.name);
    expect(names).not.toContain('Sam Other');
    expect(names).not.toContain('Alex Kim');
    expect(names.length).toBe(6);
  });

  it('an admin sees every borrower row', async () => {
    expect((await rows(await get('/contacts', admin))).length).toBe(8);
  });

  it('an agent with no Salesforce Id gets 403, not every row', async () => {
    const res = await get('/contacts', unlinkedAgent);
    expect(res.status).toBe(403);
    expect(executeSoql).not.toHaveBeenCalled();
  });

  it('no role ever gets a free-text key', async () => {
    for (const token of [agent, lo, admin]) {
      for (const row of await rows(await get('/contacts', token))) {
        for (const key of FREE_TEXT_KEYS) expect(row).not.toHaveProperty(key);
      }
    }
  });

  it('rejects a date that is not YYYY-MM-DD before building SOQL', async () => {
    const res = await get(`/contacts?dateFrom=${encodeURIComponent("2026-01-01' OR")}`, admin);
    expect(res.status).toBe(400);
    expect(executeSoql).not.toHaveBeenCalled();
  });
});

describe('nothing writes and nothing reads notes', () => {
  it('PATCH /api/contacts is gone', async () => {
    const res = await fetch(`${base}/contacts`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: [{ id: '00QVr000001aaaaAAA', fields: { status: 'Closed' } }] }),
    });
    expect(res.status).toBe(404);
  });

  it('activity and history routes are gone for every role', async () => {
    for (const token of [agent, lo, admin]) {
      expect((await get('/contacts/00QVr000001aaaaAAA/activity', token)).status).toBe(404);
      expect((await get('/contacts/00QVr000001aaaaAAA/history', token)).status).toBe(404);
    }
    expect(executeSoql).not.toHaveBeenCalled();
  });
});
