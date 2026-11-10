import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

process.env.MOCK_SALESFORCE = 'true';
process.env.APP_JWT_SECRET = 'test-secret';

const { default: app } = await import('../app.js');
const { createSessionToken } = await import('../services/auth.js');
const { MOCK_AGENT_CONTACT_ID, mockWrites, resetMockNotes } = await import('../services/salesforce/mock.js');

// The buying stage replaced the realtor steps (lead-lens-50f), so Lead Lens no longer reads
// or completes Salesforce Tasks: the only write left is the Realtor_Note__c insert.
const agent = createSessionToken('u-agent', 'agent', 'Test Agent', undefined, undefined, MOCK_AGENT_CONTACT_ID);
const JOHN = '00QMOCKLEAD00001AA';
const TASK = '00TMOCKTASK00001AA';

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  resetMockNotes();
});
afterAll(() => { server.close(); });

describe('realtor task routes are gone', () => {
  it.each([
    ['GET', '/contacts/tasks/open'],
    ['GET', `/contacts/${JOHN}/tasks`],
    ['POST', `/contacts/${JOHN}/tasks/${TASK}/complete`],
  ])('%s %s answers 404 for the realtor and writes nothing', async (method, path) => {
    const res = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${agent}` } });
    expect(res.status).toBe(404);
    expect(mockWrites).toHaveLength(0);
  });
});
