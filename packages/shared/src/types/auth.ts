import type { PaginatedResponse } from './api.js';

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

// ── User list items ─────────────────────────────────────────────────

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
  activeLeads?: number;
}

export interface AdminListItem extends UserListItem {
  sfField?: string;
  sfValue?: string;
}

/** @deprecated Use UserListItem instead */
export type LoanOfficerListItem = UserListItem;
/** @deprecated Use UserListItem instead */
export type AgentListItem = UserListItem;
/** @deprecated Use PaginatedResponse<UserListItem> instead */
export type PaginatedLoanOfficerResponse = PaginatedResponse<UserListItem>;
/** @deprecated Use PaginatedResponse<UserListItem> instead */
export type PaginatedAgentResponse = PaginatedResponse<UserListItem>;
/** @deprecated Use PaginatedResponse<AdminListItem> instead */
export type PaginatedAdminResponse = PaginatedResponse<AdminListItem>;

// ── Loan Officer requests ───────────────────────────────────────────

export interface CreateLoanOfficerRequest {
  name: string;
  email: string;
}

export interface UpdateLoanOfficerRequest {
  name?: string;
  email?: string;
  status?: 'active' | 'disabled';
}

export interface RegenerateCodeResponse {
  accessCode: string;
}

// ── Agent requests ──────────────────────────────────────────────────

export interface CreateAgentRequest {
  name: string;
  email: string;
}

export interface UpdateAgentRequest {
  name?: string;
  email?: string;
  status?: 'active' | 'disabled';
}

// ── Admin requests ──────────────────────────────────────────────────

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

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
