import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import type { ContactRow, RealtorTask } from '@lead-lens/shared';

process.env.MOCK_SALESFORCE = 'true';
process.env.APP_JWT_SECRET = 'test-secret';

const AGENT_ID = '11111111-1111-4111-8111-111111111111';
const LO_ID = '22222222-2222-4222-8222-222222222222';
const UNLINKED_ID = '33333333-3333-4333-8333-333333333333';
const ADMIN_ID = '44444444-4444-4444-8444-444444444444';

// The Lead Lens users an admin can view as, instead of the database
vi.mock('../services/view-as.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../services/view-as.js')>();
  const { MOCK_AGENT_CONTACT_ID, MOCK_LO_USER_ID } = await import('../services/salesforce/mock.js');
  const users: Record<string, { role: string; sfContactId: string | null; sfUserId: string | null }> = {
    [AGENT_ID]: { role: 'agent', sfContactId: MOCK_AGENT_CONTACT_ID, sfUserId: null },
    [LO_ID]: { role: 'loan_officer', sfContactId: null, sfUserId: MOCK_LO_USER_ID },
    [UNLINKED_ID]: { role: 'agent', sfContactId: null, sfUserId: null },
    [ADMIN_ID]: { role: 'admin', sfContactId: null, sfUserId: null },
  };
  return { ...real, findViewAsUser: async (id: string) => users[id] ?? null };
});

const { default: app } = await import('../app.js');
const { createSessionToken } = await import('../services/auth.js');
const { MOCK_AGENT_CONTACT_ID, MOCK_LO_USER_ID, resetMockTasks } = await import('../services/salesforce/mock.js');

const admin = createSessionToken('u-admin', 'admin', 'Test Admin');
const agent = createSessionToken('u-agent', 'agent', 'Test Agent', undefined, undefined, MOCK_AGENT_CONTACT_ID);
const lo = createSessionToken('u-lo', 'loan_officer', 'Test LO', undefined, undefined, MOCK_LO_USER_ID);

// Lead 1 (John Smith): the test agent's; lead 6: the other agent's
const MINE = '00QMOCKLEAD00001AA';
const NOT_MINE = '00QMOCKLEAD00006AA';
const CALL_1 = '00TMOCKTASK00001AA';

let server: Server;
let base: string;
beforeAll(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => { server.close(); });
beforeEach(() => { resetMockTasks(); });

function get(path: string, token: string) {
  return fetch(`${base}/contacts${path}`, { headers: { Authorization: `Bearer ${token}` } });
}
async function data<T>(res: Response): Promise<T> {
  return (await res.json() as { data: T }).data;
}

describe('admin views the dashboard as one agent or loan officer', () => {
  it('shows exactly the rows the agent sees herself', async () => {
    const own = await data<ContactRow[]>(await get('', agent));
    const res = await get(`?asUser=${AGENT_ID}`, admin);
    expect(res.status).toBe(200);
    expect((await data<ContactRow[]>(res)).map(r => r.id)).toEqual(own.map(r => r.id));
  });

  it('shows exactly the rows the loan officer sees himself', async () => {
    const own = await data<ContactRow[]>(await get('', lo));
    expect((await data<ContactRow[]>(await get(`?asUser=${LO_ID}`, admin))).map(r => r.id)).toEqual(own.map(r => r.id));
  });

  it("shows the agent's To do, with nothing the admin can complete", async () => {
    const own = await data<RealtorTask[]>(await get('/tasks/open', agent));
    const res = await get(`/tasks/open?asUser=${AGENT_ID}`, admin);
    expect(res.status).toBe(200);
    const seen = await data<RealtorTask[]>(res);
    expect(seen.map(t => t.id)).toEqual(own.map(t => t.id));
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(t => !t.canComplete)).toBe(true);
  });

  it("shows the agent's steps on a borrower read-only", async () => {
    const res = await get(`/${MINE}/tasks?asUser=${AGENT_ID}`, admin);
    expect(res.status).toBe(200);
    const seen = await data<RealtorTask[]>(res);
    expect(seen.map(t => t.id)).toContain(CALL_1);
    expect(seen.every(t => !t.canComplete)).toBe(true);
  });

  it("keeps the agent's scope: another agent's borrower is not found", async () => {
    expect((await get(`/${NOT_MINE}/tasks?asUser=${AGENT_ID}`, admin)).status).toBe(404);
    expect((await get(`/${NOT_MINE}/notes?asUser=${AGENT_ID}`, admin)).status).toBe(404);
  });

  it('a loan officer has no To do list', async () => {
    expect((await get(`/tasks/open?asUser=${LO_ID}`, admin)).status).toBe(403);
  });

  it('is for admins only', async () => {
    expect((await get(`?asUser=${AGENT_ID}`, agent)).status).toBe(403);
    expect((await get(`/tasks/open?asUser=${AGENT_ID}`, lo)).status).toBe(403);
  });

  it('refuses a malformed, unknown, admin or unlinked user', async () => {
    expect((await get('?asUser=not-a-uuid', admin)).status).toBe(400);
    expect((await get('?asUser=55555555-5555-4555-8555-555555555555', admin)).status).toBe(404);
    expect((await get(`?asUser=${ADMIN_ID}`, admin)).status).toBe(404);
    const unlinked = await get(`?asUser=${UNLINKED_ID}`, admin);
    expect(unlinked.status).toBe(403);
    expect(((await unlinked.json()) as { error: { code: string } }).error.code).toBe('NO_SCOPE');
  });
});
