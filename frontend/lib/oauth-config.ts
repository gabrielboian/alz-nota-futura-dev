/**
 * OAuth Configuration — Microsoft only (no Google for ALZ Nota Futura).
 */

export const oauthConfig = {
  microsoft: {
    clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID || 'common'}`,
    redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/login` : '',
    scopes: ['user.read'],
  },
};

export const isOAuthConfigured = {
  microsoft: !!oauthConfig.microsoft.clientId,
};
