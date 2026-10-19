export function mpesaHealth(env: Record<string, string | undefined> = process.env) {
  const missing = ['PAYHERO_API_USERNAME', 'PAYHERO_API_PASSWORD', 'PAYHERO_CHANNEL_ID'].filter((key) => !env[key]?.trim());
  const issues = missing.map((key) => `Missing ${key}.`);
  if (env.PAYHERO_CHANNEL_ID && (!Number.isInteger(Number(env.PAYHERO_CHANNEL_ID)) || Number(env.PAYHERO_CHANNEL_ID) <= 0)) issues.push('PAYHERO_CHANNEL_ID must be a positive integer.');
  const appUrl = (env.APP_URL || '').replace(/\/+$/, '');
  const callback = (env.PAYHERO_CALLBACK_URL || (appUrl ? `${appUrl}/api/mpesa/callback` : '')).replace(/\$\{APP_URL\}|\$APP_URL/g, appUrl);
  try {
    const url = new URL(callback);
    if (url.protocol !== 'https:' || /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(url.hostname)) issues.push('Set PAYHERO_CALLBACK_URL to a public HTTPS callback address.');
  } catch { issues.push('A valid public PAYHERO_CALLBACK_URL or APP_URL is required.'); }
  return { ready: issues.length === 0, issues };
}
