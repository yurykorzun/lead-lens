export const FIELD_MAP = {
  status: 'Status__c',
  temperature: 'Temparture__c',
  noOfCalls: 'No_of_Calls__c',
  message: 'Message_QuickUpdate__c',
  hotLead: 'Hot_Lead__c',
  paal: 'PAAL__c',
  inProcess: 'In_Process__c',
  stage: 'MtgPlanner_CRM__Stage__c',
  thankYouToReferralSource: 'MtgPlanner_CRM__Thank_you_to_Referral_Source__c',
  bdr: 'BDR__c',
  loanPartner: 'Loan_Partners__c',
  leonLoanPartner: 'Leon_Loan_Partner__c',
  maratLoanPartner: 'Marat__c',
  leonBdr: 'Leon_BDR__c',
  maratBdr: 'Marat_BDR__c',
  leadSource: 'LeadSource',
  isClient: 'Is_Client__c',
  referredByText: 'MtgPlanner_CRM__Referred_By_Text__c',
  lastTouch: 'MtgPlanner_CRM__Last_Touch__c',
  lastTouchSms: 'Last_Touch_via_360_SMS__c',
} as const;

export type FrontendField = keyof typeof FIELD_MAP;
export type SalesforceField = (typeof FIELD_MAP)[FrontendField];

const reversedEntries = Object.entries(FIELD_MAP).map(
  ([k, v]) => [v, k] as const
);
export const REVERSE_FIELD_MAP = Object.fromEntries(reversedEntries) as Record<
  SalesforceField,
  FrontendField
>;
