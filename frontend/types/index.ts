// Internal user role types for ALZ Nota Futura
export type InternalRoleType = 'COMERCIAL' | 'LOGISTICS' | 'FISCAL' | 'ADMIN';

export interface InternalUserRole {
  id: number;
  role: InternalRoleType;
  role_display: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  full_name: string;
  is_internal_staff: boolean;
  is_superuser: boolean;
  has_oauth: boolean;
  has_password: boolean;
  needs_password_change: boolean;
  force_password_change: boolean;
  microsoft_oauth_uid?: string | null;
  last_login?: string | null;
  last_login_ip?: string | null;
  date_joined: string;
  is_active: boolean;
  internal_roles?: InternalUserRole[];
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
