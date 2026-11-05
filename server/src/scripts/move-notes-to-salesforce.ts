/**
 * Copy the notes still in the Neon `notes` table into Realtor_Note__c in lgc-ci
 * (lendinggroupco-uhnx.12.4), keeping their author and original date.
 *
 * Report only by default: it lists each note and whether it is already in Salesforce,
 * and writes nothing. --apply inserts the missing ones, then prints the Neon count next
 * to the Salesforce count so they can be compared. A second --apply writes 0, because a
 * note already moved (same record, author, text and second) is skipped.
 *
 * The note text is never printed - it is borrower data. Only its length is.
 *
 * Usage (credentials: see scripts/lgc-ci.ts; notes come from DATABASE_URL):
 *   npx tsx server/src/scripts/move-notes-to-salesforce.ts            # report only
 *   npx tsx server/src/scripts/move-notes-to-salesforce.ts --apply    # write
 *   it refuses any org but lgc-ci unless --any-org is passed
 */
import 'dotenv/config';
import { asc } from 'drizzle-orm';
import { isSfId } from '../services/validate.js';
import {
  buildMovedNoteInsert, isAlreadyMoved, parentType,
  type ContactAccount, type LeadConversion, type MovedNote, type NeonNote,
} from '../services/move-notes.js';
import { chunks, insert, query, requireLgcCi } from './lgc-ci.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const anyOrg = args.includes('--any-org');

const quote = (id: string) => `'${id}'`;

async function loadNeonNotes(): Promise<NeonNote[]> {
  const { getDb } = await import('../db/index.js');
  const { notes } = await import('../db/schema.js');
  const rows = await getDb().select().from(notes).orderBy(asc(notes.createdAt));
  for (const r of rows) {
    // Every Id goes into SOQL below, and the REST query endpoint has no binds
    if (!isSfId(r.sfRecordId)) throw new Error(`Neon note ${r.id} has an invalid record Id`);
  }
  return rows;
}

async function leadConversions(leadIds: string[]): Promise<Map<string, LeadConversion>> {
  const out = new Map<string, LeadConversion>();
  for (const batch of chunks(leadIds, 200)) {
    const rows = await query<{
      Id: string; IsConverted: boolean; ConvertedContactId: string | null; ConvertedAccountId: string | null;
      ConvertedAccount: { IsPersonAccount: boolean } | null;
    }>(`SELECT Id, IsConverted, ConvertedContactId, ConvertedAccountId, ConvertedAccount.IsPersonAccount FROM Lead WHERE Id IN (${batch.map(quote).join(',')})`);
    for (const r of rows) {
      out.set(r.Id, { ...r, personAccount: Boolean(r.ConvertedAccount?.IsPersonAccount) });
    }
  }
  return out;
}

async function contactAccounts(contactIds: string[]): Promise<Map<string, ContactAccount>> {
  const out = new Map<string, ContactAccount>();
  for (const batch of chunks(contactIds, 200)) {
    const rows = await query<{ Id: string; AccountId: string | null; Account: { IsPersonAccount: boolean } | null }>(
      `SELECT Id, AccountId, Account.IsPersonAccount FROM Contact WHERE Id IN (${batch.map(quote).join(',')})`,
    );
    for (const r of rows) out.set(r.Id, { Id: r.Id, AccountId: r.AccountId, personAccount: Boolean(r.Account?.IsPersonAccount) });
  }
  return out;
}

async function movedNotes(recordIds: string[]): Promise<MovedNote[]> {
  const out: MovedNote[] = [];
  for (const batch of chunks(recordIds, 200)) {
    const list = batch.map(quote).join(',');
    out.push(...await query<MovedNote>(
      'SELECT Id, Body__c, Author_Name__c, Written_At__c, Parent_Lead__c, Parent_Contact__c FROM Realtor_Note__c ' +
      `WHERE Source__c = 'Lead Lens' AND (Parent_Lead__c IN (${list}) OR Parent_Contact__c IN (${list}))`,
    ));
  }
  return out;
}

async function main() {
  await requireLgcCi(anyOrg);
  const neon = await loadNeonNotes();
  console.log(`Neon notes: ${neon.length}`);
  if (neon.length === 0) return;

  const recordIds = [...new Set(neon.map(n => n.sfRecordId))];
  const leads = await leadConversions(recordIds.filter(id => parentType(id) === 'Lead'));
  const contacts = await contactAccounts(recordIds.filter(id => parentType(id) === 'Contact'));
  const existing = await movedNotes(recordIds);

  const perType = new Map<string, number>();
  const toMove: NeonNote[] = [];
  for (const n of neon) {
    const type = parentType(n.sfRecordId);
    perType.set(type, (perType.get(type) ?? 0) + 1);
    const lead = leads.get(n.sfRecordId);
    const done = isAlreadyMoved(n, existing);
    if (!done) toMove.push(n);
    const converted = lead?.IsConverted ? ` converted to ${lead.ConvertedContactId}` : '';
    const missing = type === 'Lead' && !lead ? ' (Lead not found in Salesforce)' : '';
    console.log(`${done ? 'already moved' : 'to move      '}  ${n.createdAt.toISOString()}  ${type} ${n.sfRecordId}${converted}${missing}  ${n.authorRole} ${n.authorName}  ${n.body.length} chars`);
  }
  console.log(`\nBy parent: ${[...perType].map(([t, c]) => `${t} ${c}`).join(', ')}`);
  console.log(`${toMove.length} to move, ${neon.length - toMove.length} already in Salesforce`);

  if (!apply) {
    console.log('Report only. Nothing was written. Re-run with --apply to copy them.');
    return;
  }

  let written = 0;
  for (const n of toMove) {
    const id = await insert('Realtor_Note__c', buildMovedNoteInsert(n, leads.get(n.sfRecordId), contacts.get(n.sfRecordId)));
    console.log(`moved ${n.id} -> ${id}`);
    written++;
  }

  // The check the bead asks for: every Neon note now has a Lead Lens copy with its old date
  const lastNeon = neon[neon.length - 1].createdAt.toISOString();
  const after = (await movedNotes(recordIds)).filter(m => m.Written_At__c && m.Written_At__c.slice(0, 19) <= lastNeon.slice(0, 19));
  console.log(`\nWrote ${written}. Neon notes: ${neon.length}. Realtor_Note__c from Lead Lens on those records, written by ${lastNeon}: ${after.length}`);
  if (after.length < neon.length) {
    console.error('Salesforce has fewer than Neon - check the lines above before removing the Neon read.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
