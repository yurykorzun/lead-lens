import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

process.env.MOCK_SALESFORCE = 'true';
process.env.APP_JWT_SECRET = 'test-secret';

// Real mock behaviour, but spied so a test can prove no SOQL was built,
// and verifyContactScope can be told a record is out of scope
vi.mock('../services/salesforce/query.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/salesforce/query.js')>();
  return {
    ...actual,
    executeSoql: vi.fn(actual.executeSoql),
    verifyContactScope: vi.fn(actual.verifyContactScope),
  };
});

const { default: app } = await import('../app.js');
const { createSessionToken } = await import('../services/auth.js');
const { executeSoql, verifyContactScope } = await import('../services/salesforce/query.js');

const ID = '003000000000001AAA';
const agent = createSessionToken('u-agent', 'agent', 'Test Agent', 'MtgPlanner_CRM__Referred_By_Text__c', 'Test Agent');
const lo = createSessionToken('u-lo', 'loan_officer', 'Test LO', 'Loan_Partners__c', 'Test LO');
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
  vi.mocked(verifyContactScope).mockClear();
});

function get(path: string, token: string) {
  return fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

async function rows(res: Response) {
  return ((await res.json()) as { data: Record<string, unknown>[] }).data;
}

const FREE_TEXT_KEYS = ['message', 'description', 'lastTouch', 'lastTouchSms'];

describe('GET /api/contacts free text', () => {
  it('never sends note fields to an agent', async () => {
    const res = await get('/contacts', agent);
    expect(res.status).toBe(200);
    const data = await rows(res);
    expect(data.length).toBeGreaterThan(0);
    for (const row of data) {
      for (const key of FREE_TEXT_KEYS) expect(row).not.toHaveProperty(key);
    }
  });

  it('still sends them to an admin, so the agent test is not passing on empty data', async () => {
    const res = await get('/contacts', admin);
    const withNotes = (await rows(res)).filter(r => r.description || r.lastTouch || r.message);
    expect(withNotes.length).toBeGreaterThan(0);
  });

  it('rejects a date that is not YYYY-MM-DD before building SOQL', async () => {
    const res = await get(`/contacts?dateFrom=${encodeURIComponent("2026-01-01' OR")}`, admin);
    expect(res.status).toBe(400);
    expect(executeSoql).not.toHaveBeenCalled();
  });
});

describe('activity and history routes', () => {
  for (const tab of ['activity', 'history']) {
    it(`${tab}: 403 for an agent`, async () => {
      const res = await get(`/contacts/${ID}/${tab}`, agent);
      expect(res.status).toBe(403);
      expect(executeSoql).not.toHaveBeenCalled();
    });

    it(`${tab}: 403 for a loan officer on a record outside their scope`, async () => {
      vi.mocked(verifyContactScope).mockResolvedValueOnce(new Set());
      const res = await get(`/contacts/${ID}/${tab}`, lo);
      expect(res.status).toBe(403);
      expect(verifyContactScope).toHaveBeenCalledWith([ID], 'loan_officer', 'Loan_Partners__c', 'Test LO');
      expect(executeSoql).not.toHaveBeenCalled();
    });

    it(`${tab}: 400 for an injected id before building SOQL`, async () => {
      const res = await get(`/contacts/${encodeURIComponent("x' OR Id != null")}/${tab}`, admin);
      expect(res.status).toBe(400);
      expect(executeSoql).not.toHaveBeenCalled();
    });
  }

  it('history: a loan officer in scope gets the data', async () => {
    const res = await get(`/contacts/${ID}/history`, lo);
    expect(res.status).toBe(200);
    expect(executeSoql).toHaveBeenCalledOnce();
  });
});

describe('PATCH /api/contacts ids', () => {
  it('rejects an id that is not a Salesforce id', async () => {
    const res = await fetch(`${base}/contacts`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: [{ id: "x' OR Id != null", fields: { status: 'Active' } }] }),
    });
    expect(res.status).toBe(400);
  });
});
