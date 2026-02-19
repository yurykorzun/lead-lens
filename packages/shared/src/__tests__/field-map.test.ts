import { describe, it, expect } from 'vitest';
import { FIELD_MAP, REVERSE_FIELD_MAP } from '../constants/field-map.js';

describe('FIELD_MAP', () => {
  it('maps camelCase to SF API names', () => {
    expect(FIELD_MAP.status).toBe('Status__c');
    expect(FIELD_MAP.temperature).toBe('Temparture__c'); // typo in SF org
    expect(FIELD_MAP.stage).toBe('MtgPlanner_CRM__Stage__c');
    expect(FIELD_MAP.loanPartner).toBe('Loan_Partners__c');
    expect(FIELD_MAP.referredByText).toBe('MtgPlanner_CRM__Referred_By_Text__c');
  });

  it('preserves the temperature typo (Temparture not Temperature)', () => {
    expect(FIELD_MAP.temperature).toContain('Temparture');
    expect(FIELD_MAP.temperature).not.toContain('Temperature');
  });

  it('uses correct Jungo namespace prefix', () => {
    expect(FIELD_MAP.stage).toMatch(/^MtgPlanner_CRM__/);
    expect(FIELD_MAP.thankYouToReferralSource).toMatch(/^MtgPlanner_CRM__/);
    expect(FIELD_MAP.referredByText).toMatch(/^MtgPlanner_CRM__/);
  });
});

describe('REVERSE_FIELD_MAP', () => {
  it('maps SF API names back to camelCase', () => {
    expect(REVERSE_FIELD_MAP['Status__c']).toBe('status');
    expect(REVERSE_FIELD_MAP['Temparture__c']).toBe('temperature');
    expect(REVERSE_FIELD_MAP['MtgPlanner_CRM__Stage__c']).toBe('stage');
  });

  it('is a bijection with FIELD_MAP', () => {
    for (const [frontend, sf] of Object.entries(FIELD_MAP)) {
      expect(REVERSE_FIELD_MAP[sf as keyof typeof REVERSE_FIELD_MAP]).toBe(frontend);
    }
  });

  it('has same number of entries as FIELD_MAP', () => {
    expect(Object.keys(REVERSE_FIELD_MAP).length).toBe(Object.keys(FIELD_MAP).length);
  });
});
