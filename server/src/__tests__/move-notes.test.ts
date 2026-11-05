import { describe, it, expect } from 'vitest';
import { buildMovedNoteInsert, isAlreadyMoved, parentType, type NeonNote, type MovedNote } from '../services/move-notes.js';

const LEAD = '00QMOCKLEAD00001AA';
const CONTACT = '003MOCKCLNT00003AA';

const note: NeonNote = {
  id: 'n1',
  sfRecordId: LEAD,
  authorName: 'Test Agent',
  authorRole: 'agent',
  body: 'Called her, pre-approval next week',
  createdAt: new Date('2026-10-24T16:44:44.253Z'),
};

describe('buildMovedNoteInsert', () => {
  it('is the app insert plus the original date', () => {
    expect(buildMovedNoteInsert(note)).toEqual({
      Body__c: 'Called her, pre-approval next week',
      Parent_Lead__c: LEAD,
      Author_Name__c: 'Test Agent',
      Author_Role__c: 'Realtor',
      Source__c: 'Lead Lens',
      Written_At__c: '2026-10-24T16:44:44.253Z',
    });
  });

  it('a note on a Contact is parented by the Contact', () => {
    const insert = buildMovedNoteInsert({ ...note, sfRecordId: CONTACT, authorRole: 'loan_officer' });
    expect(insert.Parent_Contact__c).toBe(CONTACT);
    expect(insert.Parent_Lead__c).toBeUndefined();
    expect(insert.Author_Role__c).toBe('Loan Officer');
  });

  it('a converted lead also gets its Contact, and its person account', () => {
    const insert = buildMovedNoteInsert(note, {
      Id: LEAD, IsConverted: true, ConvertedContactId: CONTACT, ConvertedAccountId: '001MOCKACCT00003AA', personAccount: true,
    });
    expect(insert).toMatchObject({ Parent_Lead__c: LEAD, Parent_Contact__c: CONTACT, Parent_Account__c: '001MOCKACCT00003AA' });
  });

  it('a business account is never set as the parent account', () => {
    const insert = buildMovedNoteInsert(note, {
      Id: LEAD, IsConverted: true, ConvertedContactId: CONTACT, ConvertedAccountId: '001MOCKBIZZ00001AA', personAccount: false,
    });
    expect(insert.Parent_Contact__c).toBe(CONTACT);
    expect(insert.Parent_Account__c).toBeUndefined();
  });

  it('an unconverted lead stays on the Lead only', () => {
    const insert = buildMovedNoteInsert(note, { Id: LEAD, IsConverted: false, ConvertedContactId: null, ConvertedAccountId: null, personAccount: false });
    expect(insert.Parent_Contact__c).toBeUndefined();
  });

  it('refuses a role Salesforce does not know', () => {
    expect(() => buildMovedNoteInsert({ ...note, authorRole: 'owner' })).toThrow();
  });
});

describe('isAlreadyMoved', () => {
  const moved: MovedNote = {
    Id: 'a1R000000000001AA',
    Body__c: note.body,
    Author_Name__c: 'Test Agent',
    Written_At__c: '2026-10-24T16:44:44.000+0000',
    Parent_Lead__c: LEAD,
    Parent_Contact__c: CONTACT,
  };

  it('matches the same note with the date cut to the second', () => {
    expect(isAlreadyMoved(note, [moved])).toBe(true);
  });

  it('matches by the Contact when the note was on the Contact', () => {
    expect(isAlreadyMoved({ ...note, sfRecordId: CONTACT }, [moved])).toBe(true);
  });

  it('a different text, author, record or time is a different note', () => {
    expect(isAlreadyMoved({ ...note, body: 'other' }, [moved])).toBe(false);
    expect(isAlreadyMoved({ ...note, authorName: 'Someone' }, [moved])).toBe(false);
    expect(isAlreadyMoved({ ...note, sfRecordId: '00QMOCKLEAD00009AA' }, [moved])).toBe(false);
    expect(isAlreadyMoved({ ...note, createdAt: new Date('2026-10-24T16:45:44.253Z') }, [moved])).toBe(false);
  });
});

describe('parentType', () => {
  it('reads the Id prefix', () => {
    expect(parentType(LEAD)).toBe('Lead');
    expect(parentType(CONTACT)).toBe('Contact');
    expect(parentType('001MOCKACCT00003AA')).toBe('other');
  });
});
