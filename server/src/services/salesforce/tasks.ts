import type { RealtorTask } from '@lead-lens/shared';
import { getSalesforceToken } from './auth.js';
import { executeSoql, quoteId, scopeCondition, type Scope } from './query.js';
import { mockUpdateRecord } from './mock.js';
import { isSfId } from '../validate.js';

// The fixed realtor task set (call 1/2/3, showing 1/2/3, lendinggroupco-uhnx.11).
// Salesforce creates the tasks and stamps Realtor_Contact__c with the realtor's Contact Id.
// Lead Lens reads ONLY tasks with that stamp - every other Task on a borrower is the LP's
// and its body carries internal notes.
//
// THE ONLY SALESFORCE WRITE IN LEAD LENS: Status = Completed on one of these tasks.
// On lgc-ci a Task completed with Update_Referred_By_via_SMS__c, _via_Email__c or
// Update_Last_Touch__c ticked texts or emails the realtor, so the body is a constant and
// nothing from the request ever reaches it.
export const TASK_FIELDS = 'Id, Subject, ActivityDate, Status, IsClosed, WhoId, Realtor_Contact__c';
const COMPLETE_BODY = Object.freeze({ Status: 'Completed' });

const ORDER = 'ORDER BY ActivityDate ASC NULLS LAST, Id ASC';

/** Realtor tasks on one borrower: hers for a realtor, all realtors' for the LO and admin */
export function buildBorrowerTasksQuery(scope: Scope, recordId: string): string {
  const marker = scope.role === 'agent'
    ? `Realtor_Contact__c = ${quoteId(scope.contactId)}`
    : 'Realtor_Contact__c != null';
  return `SELECT ${TASK_FIELDS} FROM Task WHERE WhoId = ${quoteId(recordId)} AND ${marker} ${ORDER} LIMIT 100`;
}

/** One task, only if it is this realtor's and on this borrower - the check before a write */
export function buildTaskForRealtorQuery(contactId: string, recordId: string, taskId: string): string {
  return `SELECT ${TASK_FIELDS} FROM Task WHERE Id = ${quoteId(taskId)} AND WhoId = ${quoteId(recordId)}` +
    ` AND Realtor_Contact__c = ${quoteId(contactId)} LIMIT 1`;
}

/** Her open tasks on every borrower, for the "to do" list */
export function buildOpenTasksQuery(contactId: string): string {
  return `SELECT ${TASK_FIELDS} FROM Task WHERE Realtor_Contact__c = ${quoteId(contactId)} AND IsClosed = false ${ORDER} LIMIT 200`;
}

interface TaskRecord {
  Id: string;
  Subject: string | null;
  ActivityDate: string | null;
  Status: string | null;
  IsClosed: boolean;
  WhoId: string;
  Realtor_Contact__c: string | null;
}

export function mapTask(r: TaskRecord, scope: Scope, borrowerName?: string): RealtorTask {
  return {
    id: r.Id,
    subject: r.Subject ?? '',
    dueDate: r.ActivityDate || undefined,
    status: r.Status ?? '',
    done: r.IsClosed,
    borrowerId: r.WhoId,
    borrowerName,
    canComplete: scope.role === 'agent' && r.Realtor_Contact__c === scope.contactId && !r.IsClosed,
  };
}

export async function listBorrowerTasks(scope: Scope, recordId: string): Promise<RealtorTask[]> {
  const result = await executeSoql<TaskRecord>(buildBorrowerTasksQuery(scope, recordId));
  return result.records.map(r => mapTask(r, scope));
}

export async function findTaskForRealtor(contactId: string, recordId: string, taskId: string): Promise<TaskRecord | null> {
  const result = await executeSoql<TaskRecord>(buildTaskForRealtorQuery(contactId, recordId, taskId));
  return result.records[0] ?? null;
}

/**
 * Her open tasks, minus any whose borrower is no longer on her dashboard (the referral
 * moved). One scope query for the whole list, which also gives the borrower names.
 */
export async function listOpenTasks(contactId: string): Promise<RealtorTask[]> {
  const scope: Scope = { role: 'agent', contactId };
  const tasks = (await executeSoql<TaskRecord>(buildOpenTasksQuery(contactId))).records;
  const whoIds = [...new Set(tasks.map(t => t.WhoId).filter(isSfId))];
  if (whoIds.length === 0) return [];

  const ids = whoIds.map(quoteId).join(', ');
  const rows = await executeSoql<{ Lead__c: string | null; Contact__c: string | null; First_name__c: string | null; Last_Name__c: string | null }>(
    `SELECT Lead__c, Contact__c, First_name__c, Last_Name__c FROM LeadAccount__c WHERE (Lead__c IN (${ids}) OR Contact__c IN (${ids})) AND ${scopeCondition(scope)}`,
  );
  const names = new Map<string, string>();
  for (const r of rows.records) {
    const id = r.Lead__c ?? r.Contact__c;
    if (id) names.set(id, `${r.First_name__c ?? ''} ${r.Last_Name__c ?? ''}`.trim());
  }
  return tasks.filter(t => names.has(t.WhoId)).map(t => mapTask(t, scope, names.get(t.WhoId) || undefined));
}

export async function completeTask(taskId: string): Promise<void> {
  if (!isSfId(taskId)) throw new Error('Invalid Salesforce Id');
  const body = { ...COMPLETE_BODY };
  if (process.env.MOCK_SALESFORCE === 'true') {
    mockUpdateRecord('Task', taskId, body);
    return;
  }

  const { accessToken, instanceUrl } = await getSalesforceToken();
  const response = await fetch(
    `${instanceUrl}/services/data/${process.env.SF_API_VERSION || 'v62.0'}/sobjects/Task/${taskId}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(`Task update failed: ${response.status} ${await response.text()}`);
  }
}
