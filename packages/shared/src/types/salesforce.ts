export interface SFQueryResponse<T = Record<string, unknown>> {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: Array<T & { attributes: { type: string; url: string } }>;
}

export interface SFSaveResult {
  id: string;
  success: boolean;
  errors: Array<{
    statusCode: string;
    message: string;
    fields: string[];
  }>;
}

export interface SFTokenResponse {
  access_token: string;
  instance_url: string;
  token_type: string;
  issued_at: string;
}

export interface SFDescribeResult {
  fields: Array<{
    name: string;
    label: string;
    type: string;
    picklistValues?: Array<{
      active: boolean;
      value: string;
      label: string;
    }>;
  }>;
}
