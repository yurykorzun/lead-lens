import { describe, it, expect } from 'vitest';
import {
  mockExecuteSoql,
  mockDescribeObject,
  mockGetSalesforceToken,
  MOCK_AGENT_CONTACT_ID,
} from '../services/salesforce/mock.js';
import { buildContactQuery } from '../services/salesforce/query.js';

// The mock reads the SOQL the real builder writes, so these go through buildContactQuery
const admin = { role: 'admin' as const };

describe('mockExecuteSoql', () => {
  it('returns LeadAccount__c shaped rows', () => {
    const result = mockExecuteSoql(buildContactQuery(admin, {}).dataQuery);
    expect(result.totalSize).toBe(8);
    expect(result.records[0]).toHaveProperty('First_Name__c');
    expect(result.records[0].attributes.type).toBe('LeadAccount__c');
  });

  it('handles COUNT queries', () => {
    const result = mockExecuteSoql(buildContactQuery(admin, {}).countQuery);
    expect(result.totalSize).toBe(8);
    expect(result.records).toEqual([]);
  });

  it('scopes an agent by Contact Id', () => {
    const q = buildContactQuery({ role: 'agent', contactId: MOCK_AGENT_CONTACT_ID }, {}).countQuery;
    expect(mockExecuteSoql(q).totalSize).toBe(6);
  });

  it('filters clients, a lead status, temperature and search', () => {
    expect(mockExecuteSoql(buildContactQuery(admin, { status: 'Client' }).countQuery).totalSize).toBe(3);
    expect(mockExecuteSoql(buildContactQuery(admin, { status: 'Nurture' }).countQuery).totalSize).toBe(1);
    expect(mockExecuteSoql(buildContactQuery(admin, { temperature: '60 days or less' }).countQuery).totalSize).toBe(2);
    expect(mockExecuteSoql(buildContactQuery(admin, { search: 'smi' }).countQuery).totalSize).toBe(1);
  });

  it('applies LIMIT and OFFSET', () => {
    const result = mockExecuteSoql(buildContactQuery(admin, { page: 2, pageSize: 3 }).dataQuery);
    expect(result.records.length).toBe(3);
    expect(result.totalSize).toBe(8);
  });
});

describe('mockDescribeObject', () => {
  it('describes the lgc-ci picklists', () => {
    expect(mockDescribeObject('Lead').fields.map(f => f.name)).toEqual(['Status', 'Temperature__c', 'LeadSource']);
    expect(mockDescribeObject('Opportunity').fields.map(f => f.name)).toEqual(['StageName']);
  });
});

describe('mockGetSalesforceToken', () => {
  it('returns mock token', () => {
    const result = mockGetSalesforceToken();
    expect(result.accessToken).toBe('mock-token');
    expect(result.instanceUrl).toBe('https://mock.salesforce.com');
  });
});
