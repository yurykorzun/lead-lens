import { describe, it, expect } from 'vitest';
import { isSfId, isIsoDate } from '../services/validate.js';
import { buildContactQuery } from '../services/salesforce/query.js';

describe('isSfId', () => {
  it('accepts 15 and 18 character ids', () => {
    expect(isSfId('003000000000001')).toBe(true);
    expect(isSfId('003000000000001AAA')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isSfId("x' OR Id != null")).toBe(false);
    expect(isSfId('0030000000000011')).toBe(false);
    expect(isSfId('')).toBe(false);
    expect(isSfId(undefined)).toBe(false);
  });
});

describe('isIsoDate', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(isIsoDate('2026-10-07')).toBe(true);
  });

  it('rejects injected or malformed dates', () => {
    expect(isIsoDate("2026-01-01' OR")).toBe(false);
    expect(isIsoDate('2026-13-45')).toBe(false);
    expect(isIsoDate('07/10/2026')).toBe(false);
  });
});

describe('buildContactQuery input handling', () => {
  it('refuses a bad date even if a caller skips the route check', () => {
    expect(() => buildContactQuery({ role: 'admin' }, { dateFrom: '2026-01-01T00:00:00Z OR Id != null' })).toThrow();
  });

  it('escapes a trailing backslash so it cannot eat the quote escape', () => {
    const { dataQuery } = buildContactQuery({ role: 'admin' }, { search: "a\\' OR Name != null" });
    expect(dataQuery).toContain("LIKE '%a\\\\\\' OR Name != null%'");
  });
});
