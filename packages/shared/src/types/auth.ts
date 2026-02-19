export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'loan_officer' | 'agent';
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
  activeLeads?: number;
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

export interface AgentListItem {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
  activeLeads?: number;
}

export interface CreateAgentRequest {
  name: string;
  email: string;
}

export interface UpdateAgentRequest {
  name?: string;
  email?: string;
  status?: 'active' | 'disabled';
}

export interface PaginatedAgentResponse {
  items: AgentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminListItem {
  id: string;
  name: string;
  email: string;
  status: string;
  sfField?: string;
  sfValue?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface CreateAdminRequest {
  name: string;
  email: string;
  password: string;
  sfField?: string;
  sfValue?: string;
}

export interface UpdateAdminRequest {
  name?: string;
  email?: string;
  status?: 'active' | 'disabled';
  sfField?: string;
  sfValue?: string;
}

export interface PaginatedAdminResponse {
  items: AdminListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
