import { describe, it, expect } from 'vitest';
import {
  classifyAgent, classifyLoanOfficer, escapeSoqlString, formatResultLine, normalizeName,
  type ContactCandidate,
} from '../services/sf-id-match.js';

const contact = (Id: string, recordType: string | null, referrals = 0): ContactCandidate =>
  ({ Id, Name: 'Jane Doe', accountName: 'Some Realty', recordType, referrals });

describe('classifyAgent', () => {
  it('matches the single realtor-shaped Contact', () => {
    const r = classifyAgent([contact('003A', 'Partner', 12)]);
    expect(r).toMatchObject({ kind: 'match', id: '003A' });
  });

  it('counts person-account realtors (Individual_Partner) as realtors', () => {
    expect(classifyAgent([contact('003B', 'Individual_Partner')])).toMatchObject({ kind: 'match', id: '003B' });
  });

  it('ignores a borrower namesake next to one realtor', () => {
    expect(classifyAgent([contact('003A', 'Partner'), contact('003P', 'PersonAccount')]))
      .toMatchObject({ kind: 'match', id: '003A' });
  });

  it('is AMBIGUOUS when two realtors share the name', () => {
    const r = classifyAgent([contact('003A', 'Partner', 5), contact('003B', 'Individual_Partner', 0)]);
    expect(r.kind).toBe('ambiguous');
    if (r.kind === 'ambiguous') expect(r.candidates).toHaveLength(2);
  });

  it('is NO MATCH when only borrowers have the name', () => {
    const r = classifyAgent([contact('003P', 'PersonAccount')]);
    expect(r.kind).toBe('none');
  });

  it('is NO MATCH with no candidates', () => {
    expect(classifyAgent([])).toEqual({ kind: 'none' });
  });
});

describe('classifyLoanOfficer', () => {
  it('matches the single active User', () => {
    expect(classifyLoanOfficer([{ Id: '005A', Name: 'X', IsActive: true }, { Id: '005B', Name: 'X', IsActive: false }]))
      .toEqual({ kind: 'match', id: '005A' });
  });

  it('is NO MATCH when only inactive Users have the name', () => {
    expect(classifyLoanOfficer([{ Id: '005B', Name: 'X', IsActive: false }]).kind).toBe('none');
  });

  it('is AMBIGUOUS with two active Users', () => {
    expect(classifyLoanOfficer([{ Id: '005A', Name: 'X', IsActive: true }, { Id: '005C', Name: 'X', IsActive: true }]).kind)
      .toBe('ambiguous');
  });
});

describe('helpers', () => {
  it('escapes quotes and backslashes for SOQL', () => {
    expect(escapeSoqlString("O'Brien")).toBe("O\\'Brien");
    expect(escapeSoqlString('a\\b')).toBe('a\\\\b');
  });

  it('normalizes case and spacing', () => {
    expect(normalizeName('  Jane   DOE ')).toBe('jane doe');
  });

  it('prints one line per user with the outcome', () => {
    expect(formatResultLine('agent', 'Jane Doe', null, { kind: 'none' })).toContain('NO MATCH');
    expect(formatResultLine('loan_officer', 'Lo One', '005A', { kind: 'ambiguous', candidates: ['005B', '005C'] }))
      .toContain('AMBIGUOUS (2)');
  });
});
