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
  search?: string;
  status?: string;
  temperature?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function buildContactQuery(params: ContactQueryParams): { dataQuery: string; countQuery: string } {
  const { sfField, sfValue, search, status, temperature, dateFrom, dateTo } = params;
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 50, 200);
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  conditions.push(`${sfField} = '${escapeSOQL(sfValue)}'`);

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

  const dataQuery = `SELECT ${CONTACT_FIELDS} FROM Contact WHERE ${where} ORDER BY LastModifiedDate DESC LIMIT ${pageSize} OFFSET ${offset}`;
  const countQuery = `SELECT COUNT() FROM Contact WHERE ${where}`;

  return { dataQuery, countQuery };
}
