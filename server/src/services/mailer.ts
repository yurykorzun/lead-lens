const SENDER = () => process.env.MS_GRAPH_SENDER ?? 'no-reply@lendinggroupco.com';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId!,
        client_secret: clientSecret!,
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get Graph token: ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const token = await getAccessToken();

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${SENDER()}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: html },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: false,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph sendMail error ${res.status}: ${err}`);
  }
}

export function welcomeEmailHtml(name: string, email: string, accessCode: string, loginUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h2 style="margin-bottom: 4px;">Welcome to Lead Lens</h2>
  <p style="color: #555; margin-top: 0;">Hi ${name}, your account has been created.</p>

  <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 8px 0;"><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
    <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
    <p style="margin: 0;"><strong>Access Code:</strong> <span style="font-family: monospace; font-size: 18px; font-weight: bold; letter-spacing: 2px;">${accessCode}</span></p>
  </div>

  <p style="color: #555; font-size: 14px;">Use your email and access code to sign in. Keep this code in a safe place.</p>
  <p style="color: #999; font-size: 12px;">This email was sent by Lead Lens. Do not reply to this email.</p>
</body>
</html>
  `.trim();
}
