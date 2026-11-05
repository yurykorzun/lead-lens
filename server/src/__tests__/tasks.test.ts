import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/salesforce/auth.js', () => ({
  getSalesforceToken: async () => ({ accessToken: 'tok', instanceUrl: 'https://org.example.com' }),
}));

const { buildBorrowerTasksQuery, buildOpenTasksQuery, buildTaskForRealtorQuery, completeTask, TASK_FIELDS } =
  await import('../services/salesforce/tasks.js');

const REALTOR = '003Vr000012cf87IAA';
const LEAD = '00QVr00000AbCdEIAZ';
const TASK = '00TVr00000XyZ12IAA';

describe('realtor task queries', () => {
  it('reads no long text fields', () => {
    expect(TASK_FIELDS).not.toMatch(/Description|Message|Note|Update_/);
  });

  it('the realtor reads only tasks marked for her on that borrower', () => {
    const q = buildBorrowerTasksQuery({ role: 'agent', contactId: REALTOR }, LEAD);
    expect(q).toContain(`WhoId = '${LEAD}'`);
    expect(q).toContain(`Realtor_Contact__c = '${REALTOR}'`);
  });

  it('the LO and admin read every realtor task on the borrower, never unmarked ones', () => {
    for (const scope of [{ role: 'admin' as const }, { role: 'loan_officer' as const, userId: '005Vr00000LU7MXIA1' }]) {
      const q = buildBorrowerTasksQuery(scope, LEAD);
      expect(q).toContain(`WhoId = '${LEAD}'`);
      expect(q).toContain('Realtor_Contact__c != null');
    }
  });

  it('the re-read before a write pins the task, the borrower and the realtor', () => {
    const q = buildTaskForRealtorQuery(REALTOR, LEAD, TASK);
    expect(q).toContain(`Id = '${TASK}'`);
    expect(q).toContain(`WhoId = '${LEAD}'`);
    expect(q).toContain(`Realtor_Contact__c = '${REALTOR}'`);
  });

  it('open tasks are hers and not closed', () => {
    const q = buildOpenTasksQuery(REALTOR);
    expect(q).toContain(`Realtor_Contact__c = '${REALTOR}'`);
    expect(q).toContain('IsClosed = false');
  });

  it('refuses anything that is not a Salesforce Id', () => {
    expect(() => buildBorrowerTasksQuery({ role: 'admin' }, "x' OR Id != '")).toThrow();
    expect(() => buildTaskForRealtorQuery(REALTOR, LEAD, "00T' OR Id != '")).toThrow();
  });
});

describe('completeTask against Salesforce', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    process.env.MOCK_SALESFORCE = 'false';
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('sends one PATCH to that Task with Status: Completed and nothing else', async () => {
    await completeTask(TASK);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(new RegExp(`/sobjects/Task/${TASK}$`));
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ Status: 'Completed' });
  });

  it('throws when Salesforce refuses, so the route reports it', async () => {
    fetchMock.mockResolvedValue(new Response('[{"errorCode":"INSUFFICIENT_ACCESS"}]', { status: 403 }));
    await expect(completeTask(TASK)).rejects.toThrow(/403/);
  });

  it('never builds a URL from a bad Id', async () => {
    await expect(completeTask('../Contact/003')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
