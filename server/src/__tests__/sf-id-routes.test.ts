import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// The database must never be reached for a bad Id: validation answers 400 first.
// If a handler did touch the DB, getDb throws and the route answers 500 instead.
vi.mock('../db/index.js', () => ({
  getDb: () => { throw new Error('DB must not be reached'); },
}));

process.env.APP_JWT_SECRET = 'test-secret';

const { createSessionToken } = await import('../services/auth.js');
const agentsRouter = (await import('../routes/agents.js')).default;
const loRouter = (await import('../routes/loan-officers.js')).default;

let server: Server;
let base: string;
const token = createSessionToken('admin-1', 'admin', 'Test Admin');

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/agents', agentsRouter);
  app.use('/api/loan-officers', loRouter);
  server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => { server.close(); });

function call(method: string, path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

describe('Salesforce Id validation on admin user routes', () => {
  const bad = ["x' OR Id != null", '003abc', '003a500001SpYbJEAVXX', 'not-an-id-at-all!'];

  for (const value of bad) {
    it(`POST /api/agents rejects sfContactId ${JSON.stringify(value)} with 400`, async () => {
      const res = await call('POST', '/api/agents', { name: 'A Agent', email: 'a@test.com', sfContactId: value });
      expect(res.status).toBe(400);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe('VALIDATION');
    });

    it(`PATCH /api/loan-officers/:id rejects sfUserId ${JSON.stringify(value)} with 400`, async () => {
      const res = await call('PATCH', '/api/loan-officers/some-id', { sfUserId: value });
      expect(res.status).toBe(400);
    });
  }

  it('PATCH /api/agents/:id rejects a User Id where a Contact Id belongs', async () => {
    const res = await call('PATCH', '/api/agents/some-id', { sfContactId: '005a500001SpYbJEAV' });
    expect(res.status).toBe(400);
  });

  it('POST /api/loan-officers rejects a Contact Id where a User Id belongs', async () => {
    const res = await call('POST', '/api/loan-officers', { name: 'L O', email: 'lo@test.com', sfUserId: '003a500001SpYbJEAV' });
    expect(res.status).toBe(400);
  });

  it('a valid Id passes validation and reaches the database', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call('PATCH', '/api/agents/some-id', { sfContactId: '003a500001SpYbJEAV' });
    expect(res.status).toBe(500);
    quiet.mockRestore();
  });
});
