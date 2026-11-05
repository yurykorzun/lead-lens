import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/salesforce/auth.js', () => ({
  getSalesforceToken: async () => ({ accessToken: 'tok', instanceUrl: 'https://org.example.com' }),
}));

const { buildNotesQuery, listRealtorNotes } = await import('../services/salesforce/realtor-notes.js');

const LEAD = '00QVr00000AbCdEIAZ';
const ids = { leadIds: [LEAD], contactIds: [], accountIds: [], opportunityIds: [] };
const reader = { name: 'Test Agent', role: 'agent' };

function note(n: number) {
  return {
    attributes: { type: 'Realtor_Note__c', url: `/x/${n}` },
    Id: `a0X${String(n).padStart(15, '0')}`,
    Body__c: `note ${n}`,
    Author_Name__c: 'LO',
    Author_Role__c: 'Loan Officer',
    Source__c: 'Salesforce',
    Written_At__c: new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString(),
  };
}

describe('reading the whole notes thread', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    delete process.env.MOCK_SALESFORCE;
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('does not cap the thread at a fixed number of notes', () => {
    expect(buildNotesQuery(ids)).not.toMatch(/\bLIMIT\b/);
  });

  it('follows nextRecordsUrl so no older note drops off the thread', async () => {
    const first = Array.from({ length: 200 }, (_, i) => note(250 - i));
    const rest = Array.from({ length: 50 }, (_, i) => note(50 - i));
    fetchMock
      .mockResolvedValueOnce(Response.json({ totalSize: 250, done: false, nextRecordsUrl: '/services/data/v62.0/query/01gNEXT-200', records: first }))
      .mockResolvedValueOnce(Response.json({ totalSize: 250, done: true, records: rest }));

    const notes = await listRealtorNotes(ids, reader);

    expect(notes).toHaveLength(250);
    expect(notes[249].body).toBe('note 1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://org.example.com/services/data/v62.0/query/01gNEXT-200');
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('fails loudly when a later page fails, rather than showing half a thread', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ totalSize: 2, done: false, nextRecordsUrl: '/services/data/v62.0/query/01gNEXT-1', records: [note(2)] }))
      .mockResolvedValueOnce(new Response('boom', { status: 500 }));
    await expect(listRealtorNotes(ids, reader)).rejects.toThrow(/500/);
  });
});
