import { describe, it, expect } from 'vitest';
import { CLIENT_STATUS } from '@lead-lens/shared';
import { buildContactQuery, scopeCondition, mapRow, type Scope } from '../services/salesforce/query.js';

const AGENT_ID = '003Vr000012cf87IAA';
const USER_ID = '005Vr00000LU7MXIA1';
const agent: Scope = { role: 'agent', contactId: AGENT_ID };
const lo: Scope = { role: 'loan_officer', userId: USER_ID };
const admin: Scope = { role: 'admin' };

describe('scope', () => {
  it('agent query binds the realtor Contact Id on every lookup and compares no names', () => {
    const { dataQuery, countQuery } = buildContactQuery(agent, {});
    for (const q of [dataQuery, countQuery]) {
      expect(q).toContain(`Lead__r.Referred_By__c = '${AGENT_ID}'`);
      expect(q).toContain(`Contact__r.Referred_By__c = '${AGENT_ID}'`);
      expect(q).toContain(`Opportunity__r.Referring_Agent__c = '${AGENT_ID}'`);
      expect(q).not.toMatch(/(?<!Developer)Name\s*=/);
      expect(q).not.toMatch(/Referred_By_Text/);
    }
  });

  it('agent query never filters the 15-char LeadAccount__c.Referred_By__c formula', () => {
    // "Referred_By__c =" with no relationship in front is the formula, which matches nothing for an 18-char Id
    expect(scopeCondition(agent)).not.toMatch(/(^|[\s(])Referred_By__c =/);
  });

  it('loan officer query binds the User Id as OwnerId', () => {
    const { dataQuery } = buildContactQuery(lo, {});
    expect(dataQuery).toContain(`Lead__r.OwnerId = '${USER_ID}'`);
    expect(dataQuery).toContain(`Contact__r.OwnerId = '${USER_ID}'`);
    expect(dataQuery).not.toMatch(/(?<!Developer)Name\s*=/);
  });

  it('admin has no scope condition but still only borrowers', () => {
    expect(scopeCondition(admin)).toBeNull();
    const { dataQuery } = buildContactQuery(admin, {});
    expect(dataQuery).toContain("Lead__r.RecordType.DeveloperName = 'Borrower'");
    expect(dataQuery).toContain("Contact__r.Account.RecordType.DeveloperName = 'PersonAccount'");
  });

  it('refuses an Id that is not a Salesforce Id instead of quoting it in', () => {
    expect(() => buildContactQuery({ role: 'agent', contactId: "x' OR Id != null" }, {})).toThrow();
    expect(() => buildContactQuery({ role: 'loan_officer', userId: 'Leon Belov' }, {})).toThrow();
  });
});

describe('no notes in any query', () => {
  const filters = [{}, { status: 'Open' }, { status: CLIENT_STATUS }, { temperature: 'Dead deal' }, { search: 'smith', dateFrom: '2026-01-01', dateTo: '2026-02-01' }];
  for (const scope of [agent, lo, admin]) {
    it(`${scope.role}: no Rep_Notes, Message_to_Realtor, Description or Task`, () => {
      for (const f of filters) {
        const { dataQuery, countQuery } = buildContactQuery(scope, f);
        for (const q of [dataQuery, countQuery]) {
          expect(q).not.toMatch(/Rep_Notes|Message_to_Realtor|Description|\bTask\b|Note_History/i);
        }
      }
    });
  }
});

describe('filters and paging', () => {
  it('Client status means rows with no Lead', () => {
    expect(buildContactQuery(admin, { status: CLIENT_STATUS }).dataQuery).toContain('Lead__c = null');
  });

  it('a lead status only matches lead rows, because a client row holds the loan stage there', () => {
    expect(buildContactQuery(admin, { status: 'Nurture' }).dataQuery).toContain("Lead__c != null AND Status__c = 'Nurture'");
  });

  it('dates filter the tracker Created date as Date literals', () => {
    const { dataQuery } = buildContactQuery(admin, { dateFrom: '2026-01-01', dateTo: '2026-01-31' });
    expect(dataQuery).toContain('Created_Date__c >= 2026-01-01');
    expect(dataQuery).toContain('Created_Date__c <= 2026-01-31');
  });

  it('caps the page so OFFSET never passes 2000', () => {
    const { dataQuery, page, maxPage } = buildContactQuery(admin, { page: 500, pageSize: 50 });
    expect(maxPage).toBe(41);
    expect(page).toBe(41);
    expect(dataQuery).toContain('OFFSET 2000');
  });
});

describe('mapRow', () => {
  it('maps a lead row', () => {
    const row = mapRow({
      Lead__c: '00QVr000001aaaaAAA', Contact__c: null, First_Name__c: 'John', Last_Name__c: 'Smith',
      Phone__c: '555', Status__c: 'Nurture', Temperature__c: '60 days or less', Lead_Source__c: 'FB',
      Created_Date__c: '2026-03-04', Referred_By_First_Name__c: 'Dmitry', Referred_By_Last_Name__c: 'Teper',
      Lead__r: { Email: 'j@x.com', Owner: { Name: 'Cami Sims' } }, Contact__r: null, Opportunity__r: null,
    });
    expect(row).toEqual({
      id: '00QVr000001aaaaAAA', kind: 'lead', name: 'John Smith', firstName: 'John', lastName: 'Smith',
      email: 'j@x.com', phone: '555', status: 'Nurture', stage: undefined, temperature: '60 days or less',
      leadSource: 'FB', referredBy: 'Dmitry Teper', ownerName: 'Cami Sims', createdDate: '2026-03-04',
    });
  });

  it('maps a client row: status Client, stage from its loan, else the newest loan stage', () => {
    const base = {
      Lead__c: null, Contact__c: '003Vr000001bbbbAAA', First_Name__c: 'Maria', Last_Name__c: 'Garcia',
      Status__c: 'Underwriting', Contact__r: { Email: 'm@x.com', Owner: { Name: 'Leon Belov' } },
    };
    expect(mapRow({ ...base, Opportunity__r: { StageName: 'Processing' } })).toMatchObject({
      id: '003Vr000001bbbbAAA', kind: 'client', status: CLIENT_STATUS, stage: 'Processing', ownerName: 'Leon Belov',
    });
    expect(mapRow({ ...base, Opportunity__r: null }).stage).toBe('Underwriting');
  });
});
