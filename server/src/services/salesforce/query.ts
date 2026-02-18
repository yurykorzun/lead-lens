import type { SFQueryResponse } from '@lead-lens/shared';
import { getSalesforceToken } from './auth.js';

const CONTACT_FIELDS = [
  'Id', 'Name', 'FirstName', 'LastName', 'Email', 'Phone', 'MobilePhone',
  'OwnerId', 'Owner.Name', 'CreatedDate', 'LastModifiedDate',
  'LeadSource', 'Status__c', 'Temparture__c', 'No_of_Calls__c',
  'Message_QuickUpdate__c', 'Hot_Lead__c', 'PAAL__c', 'In_Process__c',
  'Is_Client__c', 'MtgPlanner_CRM__Stage__c', 'MtgPlanner_CRM__Thank_you_to_Referral_Source__c',
  'BDR__c', 'Leon_BDR__c', 'Marat_BDR__c',
  'Loan_Partners__c', 'Leon_Loan_Partner__c', 'Marat__c',
  'MtgPlanner_CRM__Referred_By_Text__c', 'Description',
  'RecordTypeId',
].join(', ');

export async function executeSoql<T = Record<string, unknown>>(
  soql: string
): Promise<SFQueryResponse<T>> {
  const { accessToken, instanceUrl } = await getSalesforceToken();

  const response = await fetch(
    `${instanceUrl}/services/data/${process.env.SF_API_VERSION || 'v62.0'}/query?q=${encodeURIComponent(soql)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`SOQL query failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<SFQueryResponse<T>>;
}

function escapeSOQL(value: string): string {
  return value.replace(/'/g, "\\'");
}

interface ContactQueryParams {
  sfField: string;
  sfValue: string;
  role?: string;
  search?: string;
  status?: string;
  temperature?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
}

// LO contacts matched across all three partner fields
const LO_PARTNER_FIELDS = ['Loan_Partners__c', 'Leon_Loan_Partner__c', 'Marat__c'];
// Agent contacts matched by referred-by text
const AGENT_SCOPE_FIELDS = ['MtgPlanner_CRM__Referred_By_Text__c'];

function buildScopeCondition(role: string | undefined, sfField: string, sfValue: string): string {
  const escaped = escapeSOQL(sfValue);
  if (role === 'loan_officer') {
    return `(${LO_PARTNER_FIELDS.map(f => `${f} = '${escaped}'`).join(' OR ')})`;
  }
  if (role === 'agent') {
    return `(${AGENT_SCOPE_FIELDS.map(f => `${f} = '${escaped}'`).join(' OR ')})`;
  }
  return `${sfField} = '${escaped}'`;
}

/**
 * Verify that the given contact IDs fall within the user's scope.
 * Returns the set of IDs that are in scope.
 */
export async function verifyContactScope(
  ids: string[],
  role: string | undefined,
  sfField: string,
  sfValue: string,
): Promise<Set<string>> {
  if (role === 'admin') return new Set(ids);
  if (ids.length === 0) return new Set();

  const scopeCondition = buildScopeCondition(role, sfField, sfValue);
  const idList = ids.map(id => `'${escapeSOQL(id)}'`).join(',');
  const soql = `SELECT Id FROM Contact WHERE Id IN (${idList}) AND ${scopeCondition}`;
  const result = await executeSoql(soql);
  return new Set(result.records.map(r => r.Id as string));
}

/**
 * Count contacts in scope for multiple users in parallel.
 * Returns a map of sfValue (name) → count.
 */
export async function countContactsForUsers(
  userNames: string[],
  role: 'loan_officer' | 'agent',
  sfField: string,
): Promise<Map<string, number>> {
  if (userNames.length === 0) return new Map();

  const counts = await Promise.all(
    userNames.map(async (name) => {
      const condition = buildScopeCondition(role, sfField, name);
      const soql = `SELECT COUNT() FROM Contact WHERE ${condition}`;
      try {
        const result = await executeSoql(soql);
        return [name, result.totalSize] as const;
      } catch {
        return [name, 0] as const;
      }
    }),
  );

  return new Map(counts);
}

export function buildContactQuery(params: ContactQueryParams): { dataQuery: string; countQuery: string } {
  const { sfField, sfValue, role, search, status, temperature, dateFrom, dateTo } = params;
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 50, 200);
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  conditions.push(buildScopeCondition(role, sfField, sfValue));

  if (status) {
    conditions.push(`Status__c = '${escapeSOQL(status)}'`);
  }
  if (temperature) {
    conditions.push(`Temparture__c = '${escapeSOQL(temperature)}'`);
  }
  if (search) {
    conditions.push(`Name LIKE '%${escapeSOQL(search)}%'`);
  }
  if (dateFrom) {
    conditions.push(`CreatedDate >= ${dateFrom}T00:00:00Z`);
  }
  if (dateTo) {
    conditions.push(`CreatedDate <= ${dateTo}T23:59:59Z`);
  }

  const where = conditions.join(' AND ');

  const orderBy = params.orderBy || 'LastModifiedDate DESC';
  const dataQuery = `SELECT ${CONTACT_FIELDS} FROM Contact WHERE ${where} ORDER BY ${orderBy} LIMIT ${pageSize} OFFSET ${offset}`;
  const countQuery = `SELECT COUNT() FROM Contact WHERE ${where}`;

  return { dataQuery, countQuery };
}
