import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildRealtorSearchQuery, buildRealtorByIdQuery, escapeLike, searchRealtors, findRealtor } from '../services/salesforce/realtors.js';
import { MOCK_AGENT_CONTACT_ID } from '../services/salesforce/mock.js';

describe('realtor search query', () => {
  it('matches name or email and needs two characters', () => {
    expect(buildRealtorSearchQuery('a')).toBeNull();
    expect(buildRealtorSearchQuery('  ')).toBeNull();
    const q = buildRealtorSearchQuery(' Ross ');
    expect(q).toContain("Name LIKE '%Ross%' OR Email LIKE '%Ross%'");
    expect(q).toMatch(/FROM Contact /);
  });

  it('keeps quotes and wildcards literal', () => {
    expect(escapeLike("o'brien")).toBe("o\\'brien");
    expect(escapeLike('100%_x')).toBe('100\\%\\_x');
    expect(escapeLike('a\\')).toBe('a\\\\');
    expect(buildRealtorSearchQuery("x' OR Name != '")).toContain("LIKE '%x\\' OR Name != \\'%'");
  });

  it('never selects notes', () => {
    expect(buildRealtorSearchQuery('ross')).not.toMatch(/Description|Rep_Notes__c|Message_to_Realtor__c/);
  });

  it('only builds an Id lookup for a real Id', () => {
    expect(buildRealtorByIdQuery('003Vr000012c7f1IAA')).toContain("WHERE Id = '003Vr000012c7f1IAA'");
    expect(() => buildRealtorByIdQuery("003' OR Id != '")).toThrow();
  });
});

describe('realtor search against the mock org', () => {
  beforeAll(() => { process.env.MOCK_SALESFORCE = 'true'; });
  afterAll(() => { delete process.env.MOCK_SALESFORCE; });

  it('puts the record that carries the referrals above an empty namesake', async () => {
    const found = await searchRealtors('test agent');
    expect(found.map(r => r.id)).toEqual([MOCK_AGENT_CONTACT_ID, '003MOCKAGENT0003AA']);
    expect(found[0]).toMatchObject({ name: 'Test Agent', kind: 'Realtor', company: 'Test Realty' });
    expect(found[0].borrowers).toBeGreaterThan(0);
    expect(found[1].borrowers).toBe(0);
  });

  it('finds by email', async () => {
    expect((await searchRealtors('other.agent@')).map(r => r.name)).toEqual(['Other Agent']);
  });

  it('labels an individual realtor without a brokerage', async () => {
    const [r] = await searchRealtors('other agent');
    expect(r).toMatchObject({ kind: 'Realtor', company: undefined });
  });

  it('looks a Contact up by Id and says when there is none', async () => {
    expect((await findRealtor(MOCK_AGENT_CONTACT_ID))?.name).toBe('Test Agent');
    expect(await findRealtor('003MOCKNOBODY001AA')).toBeNull();
    expect(await findRealtor('not an id')).toBeNull();
  });
});
