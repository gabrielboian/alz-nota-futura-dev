'use client';

import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { oauthConfig, isOAuthConfigured } from '@/lib/oauth-config';

const msalInstance = isOAuthConfigured.microsoft
  ? new PublicClientApplication({
      auth: {
        clientId: oauthConfig.microsoft.clientId,
        authority: oauthConfig.microsoft.authority,
        redirectUri: oauthConfig.microsoft.redirectUri,
      },
      cache: {
        cacheLocation: 'localStorage',
      },
    })
  : null;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  if (msalInstance) {
    return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
  }
  return <>{children}</>;
}
