export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'loan_officer';
  status: 'active' | 'disabled';
  sfField?: string;
  sfValue?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface LoginRequest {
  email: string;
  password?: string;
  accessCode?: string;
}

export interface Session {
  user: User;
  token: string;
  expiresAt: string;
}

export interface CreateLoanOfficerRequest {
  name: string;
  email: string;
}

export interface UpdateLoanOfficerRequest {
  name?: string;
  email?: string;
  status?: 'active' | 'disabled';
}

export interface LoanOfficerListItem {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface RegenerateCodeResponse {
  accessCode: string;
}

export interface PaginatedLoanOfficerResponse {
  items: LoanOfficerListItem[];
  total: number;
  page: number;
  pageSize: number;
}
