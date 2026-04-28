import apiClient from './client';
import { AuthTokens, LoginCredentials, User } from '@/types';

export const authApi = {
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const response = await apiClient.post<AuthTokens>('/auth/login/', credentials);
    return response.data;
  },

  async microsoftOAuth(accessToken: string): Promise<AuthTokens> {
    const response = await apiClient.post<AuthTokens>('/auth/oauth/microsoft/', {
      access_token: accessToken,
    });
    return response.data;
  },

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post('/auth/logout/', { refresh: refreshToken });
  },

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me/');
    return response.data;
  },

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const response = await apiClient.post<AuthTokens>('/auth/token/refresh/', {
      refresh: refreshToken,
    });
    return response.data;
  },

  async resetPasswordRequest(email: string): Promise<void> {
    await apiClient.post('/auth/password/reset/request/', { email });
  },

  async resetPasswordConfirm(token: string, newPassword: string, confirmPassword: string): Promise<void> {
    await apiClient.post('/auth/password/reset/confirm/', {
      token,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
  },

  async forcePasswordChange(newPassword: string, confirmPassword: string): Promise<void> {
    await apiClient.post('/auth/password/force-change/', {
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
  },
};
