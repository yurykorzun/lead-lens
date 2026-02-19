import { describe, it, expect } from 'vitest';
import { parsePagination, isValidEmail, validateNameAndEmail, formatUserItem, getDrizzleCause, isUniqueViolation } from '../services/user-management.js';

describe('parsePagination', () => {
  it('returns defaults for empty query', () => {
    const result = parsePagination({});
    expect(result).toEqual({ page: 1, pageSize: 25, search: '', offset: 0 });
  });

  it('parses page and pageSize', () => {
    const result = parsePagination({ page: '3', pageSize: '10' });
    expect(result).toEqual({ page: 3, pageSize: 10, search: '', offset: 20 });
  });

  it('clamps page to minimum of 1', () => {
    expect(parsePagination({ page: '0' }).page).toBe(1);
    expect(parsePagination({ page: '-5' }).page).toBe(1);
  });

  it('clamps pageSize between 1 and 100', () => {
    expect(parsePagination({ pageSize: '0' }).pageSize).toBe(25); // 0 is falsy, falls back to default 25
    expect(parsePagination({ pageSize: '1' }).pageSize).toBe(1);
    expect(parsePagination({ pageSize: '200' }).pageSize).toBe(100);
  });

  it('trims search string', () => {
    expect(parsePagination({ search: '  hello  ' }).search).toBe('hello');
  });

  it('handles non-numeric values gracefully', () => {
    const result = parsePagination({ page: 'abc', pageSize: 'xyz' });
    expect(result).toEqual({ page: 1, pageSize: 25, search: '', offset: 0 });
  });
});

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('user.name+tag@domain.org')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@missing.local')).toBe(false);
    expect(isValidEmail('missing@')).toBe(false);
    expect(isValidEmail('has spaces@example.com')).toBe(false);
  });
});

describe('validateNameAndEmail', () => {
  it('returns trimmed and lowercased values for valid input', () => {
    const result = validateNameAndEmail('  John Doe  ', '  JOHN@Example.COM  ');
    expect(result).toEqual({ name: 'John Doe', email: 'john@example.com' });
  });

  it('returns error for missing name', () => {
    expect(validateNameAndEmail('', 'test@test.com')).toBe('Name and email required');
    expect(validateNameAndEmail(null, 'test@test.com')).toBe('Name and email required');
  });

  it('returns error for missing email', () => {
    expect(validateNameAndEmail('John', '')).toBe('Name and email required');
    expect(validateNameAndEmail('John', undefined)).toBe('Name and email required');
  });

  it('returns error for invalid email format', () => {
    expect(validateNameAndEmail('John', 'not-an-email')).toBe('Invalid email format');
  });
});

describe('formatUserItem', () => {
  it('formats a user with all fields', () => {
    const result = formatUserItem({
      id: '123',
      name: 'John',
      email: 'john@test.com',
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      lastLoginAt: new Date('2026-02-01T00:00:00Z'),
    });
    expect(result).toEqual({
      id: '123',
      name: 'John',
      email: 'john@test.com',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: '2026-02-01T00:00:00.000Z',
    });
  });

  it('handles null name and dates', () => {
    const result = formatUserItem({
      id: '123',
      name: null,
      email: 'test@test.com',
      status: 'active',
      createdAt: null,
      lastLoginAt: null,
    });
    expect(result.name).toBe('');
    expect(result.createdAt).toBe('');
    expect(result.lastLoginAt).toBeUndefined();
  });
});

describe('getDrizzleCause / isUniqueViolation', () => {
  it('extracts cause from Error with cause', () => {
    const err = new Error('DB error', { cause: { code: '23505', message: 'unique violation' } });
    expect(getDrizzleCause(err)).toEqual({ code: '23505', message: 'unique violation' });
  });

  it('returns undefined for non-Error', () => {
    expect(getDrizzleCause('string error')).toBeUndefined();
    expect(getDrizzleCause(null)).toBeUndefined();
  });

  it('detects unique violations', () => {
    const err = new Error('fail', { cause: { code: '23505' } });
    expect(isUniqueViolation(err)).toBe(true);
  });

  it('returns false for other errors', () => {
    const err = new Error('fail', { cause: { code: '42000' } });
    expect(isUniqueViolation(err)).toBe(false);
    expect(isUniqueViolation(new Error('no cause'))).toBe(false);
  });
});
