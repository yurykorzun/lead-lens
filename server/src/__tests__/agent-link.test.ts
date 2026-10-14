import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// An agent with no Contact sees an empty dashboard, so every rule here answers before the
// database is touched. If a handler did reach the DB, getDb throws and the route answers 500.
vi.mock('../db/index.js', () => ({
  getDb: () => { throw new Error('DB reached'); },
}));

process.env.APP_JWT_SECRET = 'test-secret';
process.env.MOCK_SALESFORCE = 'true';

const { createSessionToken } = await import('../services/auth.js');
const { MOCK_AGENT_CONTACT_ID } = await import('../services/salesforce/mock.js');
const agentsRouter = (await import('../routes/agents.js')).default;

let server: Server;
let base: string;
const admin = createSessionToken('admin-1', 'admin', 'Test Admin');
const agent = createSessionToken('agent-1', 'agent', 'Test Agent', undefined, undefined, MOCK_AGENT_CONTACT_ID);

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/agents', agentsRouter);
  server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
  delete process.env.MOCK_SALESFORCE;
});

function call(method: string, path: string, body?: unknown, token = admin) {
  return fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function message(res: Response) {
  return ((await res.json()) as { error: { message: string } }).error.message;
}

describe('creating an agent', () => {
  it('refuses an agent with no Salesforce record', async () => {
    const res = await call('POST', '/api/agents', { name: 'New Agent', email: 'new@test.com' });
    expect(res.status).toBe(400);
    expect(await message(res)).toMatch(/record in Salesforce/);
  });

  it('refuses an empty Id', async () => {
    const res = await call('POST', '/api/agents', { name: 'New Agent', email: 'new@test.com', sfContactId: '  ' });
    expect(res.status).toBe(400);
  });

  it('refuses an Id that is not a Contact in Salesforce', async () => {
    const res = await call('POST', '/api/agents', { name: 'New Agent', email: 'new@test.com', sfContactId: '003MOCKNOBODY001AA' });
    expect(res.status).toBe(400);
    expect(await message(res)).toBe('No Salesforce Contact with this Id');
  });

  it('lets a real Contact through to the database', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call('POST', '/api/agents', { name: 'New Agent', email: 'new@test.com', sfContactId: MOCK_AGENT_CONTACT_ID });
    expect(res.status).toBe(500);
    quiet.mockRestore();
  });
});

describe('editing an agent', () => {
  for (const cleared of [null, '']) {
    it(`refuses to unlink with ${JSON.stringify(cleared)}`, async () => {
      const res = await call('PATCH', '/api/agents/some-id', { sfContactId: cleared });
      expect(res.status).toBe(400);
    });
  }

  it('refuses to move the link to a Contact that does not exist', async () => {
    const res = await call('PATCH', '/api/agents/some-id', { sfContactId: '003MOCKNOBODY001AA' });
    expect(res.status).toBe(400);
  });

  it('leaves the link alone when it is not sent', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call('PATCH', '/api/agents/some-id', { name: 'Renamed' });
    expect(res.status).toBe(500);
    quiet.mockRestore();
  });
});

describe('realtor search', () => {
  it('returns matches with their borrower counts', async () => {
    const res = await call('GET', '/api/agents/realtors?q=test%20agent');
    expect(res.status).toBe(200);
    const json = await res.json() as { data: { items: { id: string; borrowers?: number }[] } };
    expect(json.data.items[0].id).toBe(MOCK_AGENT_CONTACT_ID);
    expect(json.data.items[0].borrowers).toBeGreaterThan(0);
  });

  it('looks up one Contact and 404s an unknown one', async () => {
    expect((await call('GET', `/api/agents/realtors/${MOCK_AGENT_CONTACT_ID}`)).status).toBe(200);
    expect((await call('GET', '/api/agents/realtors/003MOCKNOBODY001AA')).status).toBe(404);
  });

  it('is admin only', async () => {
    expect((await call('GET', '/api/agents/realtors?q=test', undefined, agent)).status).toBe(403);
  });
});
