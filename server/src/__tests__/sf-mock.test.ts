import { describe, it, expect } from 'vitest';
import {
  mockExecuteSoql,
  mockBulkUpdate,
  mockDescribeObject,
  mockVerifyContactScope,
  mockCountContactsForUsers,
  mockGetSalesforceToken,
} from '../services/salesforce/mock.js';

describe('mockExecuteSoql', () => {
  it('returns contacts for a basic SELECT query', () => {
    const result = mockExecuteSoql('SELECT Id, Name FROM Contact LIMIT 50');
    expect(result.done).toBe(true);
    expect(result.totalSize).toBe(8);
    expect(result.records.length).toBeLessThanOrEqual(50);
    expect(result.records[0]).toHaveProperty('Id');
    expect(result.records[0]).toHaveProperty('attributes');
  });

  it('handles COUNT queries', () => {
    const result = mockExecuteSoql("SELECT COUNT() FROM Contact WHERE Owner.Name = 'Leon Belov'");
    expect(result.done).toBe(true);
    expect(result.totalSize).toBeGreaterThan(0);
    expect(result.records).toEqual([]);
  });

  it('filters by name search (LIKE)', () => {
    const result = mockExecuteSoql("SELECT Id FROM Contact WHERE Name LIKE '%john%'");
    expect(result.records.every(r => (r as Record<string, unknown>).Name?.toString().toLowerCase().includes('john'))).toBe(true);
  });

  it('filters by status', () => {
    const result = mockExecuteSoql("SELECT Id FROM Contact WHERE Status__c = 'Active'");
    expect(result.records.every(r => (r as Record<string, unknown>).Status__c === 'Active')).toBe(true);
  });

  it('filters by temperature', () => {
    const result = mockExecuteSoql("SELECT Id FROM Contact WHERE Temparture__c = 'Hot'");
    expect(result.records.every(r => (r as Record<string, unknown>).Temparture__c === 'Hot')).toBe(true);
  });

  it('applies LIMIT and OFFSET', () => {
    const result = mockExecuteSoql('SELECT Id FROM Contact LIMIT 2 OFFSET 1');
    expect(result.records.length).toBe(2);
    expect(result.totalSize).toBe(8);
  });

  it('scopes by loan partner field', () => {
    const result = mockExecuteSoql("SELECT Id FROM Contact WHERE Loan_Partners__c = 'Test LO' OR Leon_Loan_Partner__c = 'Test LO'");
    expect(result.totalSize).toBeGreaterThan(0);
  });

  it('scopes by referred-by text', () => {
    const result = mockExecuteSoql("SELECT Id FROM Contact WHERE MtgPlanner_CRM__Referred_By_Text__c = 'Test Agent'");
    expect(result.totalSize).toBeGreaterThan(0);
  });

  it('returns tasks for Task queries', () => {
    const result = mockExecuteSoql('SELECT Id, Subject FROM Task WHERE WhoId = :id');
    expect(result.totalSize).toBe(3);
    expect(result.records[0]).toHaveProperty('Subject');
  });

  it('returns history for ContactHistory queries', () => {
    const result = mockExecuteSoql('SELECT Field, OldValue, NewValue FROM ContactHistory WHERE ContactId = :id');
    expect(result.totalSize).toBe(3);
    expect(result.records[0]).toHaveProperty('Field');
  });

  it('COUNT query for LO scope returns correct count', () => {
    const result = mockExecuteSoql("SELECT COUNT() FROM Contact WHERE Loan_Partners__c = 'Test LO'");
    expect(result.totalSize).toBeGreaterThan(0);
    expect(result.records).toEqual([]);
  });

  it('COUNT query for agent scope returns correct count', () => {
    const result = mockExecuteSoql("SELECT COUNT() FROM Contact WHERE MtgPlanner_CRM__Referred_By_Text__c = 'Test Agent'");
    expect(result.totalSize).toBeGreaterThan(0);
    expect(result.records).toEqual([]);
  });
});

describe('mockBulkUpdate', () => {
  it('returns success for each record', () => {
    const results = mockBulkUpdate('Contact', [
      { Id: '001', Status__c: 'Active' },
      { Id: '002', Temparture__c: 'Hot' },
    ]);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.success)).toBe(true);
    expect(results[0].id).toBe('001');
    expect(results[1].id).toBe('002');
  });

  it('returns empty array for empty input', () => {
    expect(mockBulkUpdate('Contact', [])).toEqual([]);
  });
});

describe('mockDescribeObject', () => {
  it('returns picklist fields', () => {
    const result = mockDescribeObject('Contact');
    expect(result.fields.length).toBeGreaterThan(0);
    const statusField = result.fields.find(f => f.name === 'Status__c');
    expect(statusField).toBeDefined();
    expect(statusField!.picklistValues!.length).toBeGreaterThan(0);
  });

  it('includes all expected picklist fields', () => {
    const result = mockDescribeObject('Contact');
    const fieldNames = result.fields.map(f => f.name);
    expect(fieldNames).toContain('Status__c');
    expect(fieldNames).toContain('Temparture__c');
    expect(fieldNames).toContain('MtgPlanner_CRM__Stage__c');
    expect(fieldNames).toContain('LeadSource');
  });
});

describe('mockVerifyContactScope', () => {
  it('returns all IDs as in-scope', () => {
    const result = mockVerifyContactScope(['001', '002', '003']);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(3);
    expect(result.has('001')).toBe(true);
  });
});

describe('mockCountContactsForUsers', () => {
  it('returns counts for each user', () => {
    const result = mockCountContactsForUsers(['Test LO', 'Unknown Person']);
    expect(result).toBeInstanceOf(Map);
    expect(result.get('Test LO')).toBeGreaterThan(0);
    expect(result.get('Unknown Person')).toBe(3); // fallback
  });
});

describe('mockGetSalesforceToken', () => {
  it('returns mock token', () => {
    const result = mockGetSalesforceToken();
    expect(result.accessToken).toBe('mock-token');
    expect(result.instanceUrl).toBe('https://mock.salesforce.com');
  });
});
