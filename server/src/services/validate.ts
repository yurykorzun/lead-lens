// Inputs that end up inside SOQL are checked against these before any query is built

const SF_ID = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isSfId(value: unknown): value is string {
  return typeof value === 'string' && SF_ID.test(value);
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));
}
