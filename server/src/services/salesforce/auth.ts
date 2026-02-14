import type { SFTokenResponse } from '@lead-lens/shared';

let cachedToken: { accessToken: string; instanceUrl: string; expiresAt: number } | null = null;

export async function getSalesforceToken(): Promise<{ accessToken: string; instanceUrl: string }> {
  // Return cached token if still valid (with 5-min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300_000) {
    return { accessToken: cachedToken.accessToken, instanceUrl: cachedToken.instanceUrl };
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SF_CONSUMER_KEY!,
    client_secret: process.env.SF_CONSUMER_SECRET!,
  });

  const response = await fetch(
    `${process.env.SF_LOGIN_URL!}/services/oauth2/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Salesforce token request failed: ${response.status} ${text}`);
  }

  const data = await response.json() as SFTokenResponse;
  cachedToken = {
    accessToken: data.access_token,
    instanceUrl: data.instance_url,
    expiresAt: Date.now() + 3600_000, // tokens last ~1 hour
  };

  return { accessToken: cachedToken.accessToken, instanceUrl: cachedToken.instanceUrl };
}
