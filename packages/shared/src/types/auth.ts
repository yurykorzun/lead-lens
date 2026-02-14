export interface User {
  id: string;
  email: string;
  role: 'loan_officer' | 'manager' | 'admin';
  status: 'pending' | 'active' | 'disabled';
  sfField?: string;
  sfValue?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
}

export interface Session {
  user: User;
  token: string;
  expiresAt: string;
}
