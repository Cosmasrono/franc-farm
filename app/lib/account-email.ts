import { BRAND } from './brand';
import nodemailer from 'nodemailer';
import * as tls from 'node:tls';

// Node 22.15+ can use the OS certificate store, including trusted SMTP proxies.
// Older Node versions keep their normal certificate verification behavior.
function trustedCertificates() {
  const getCertificates = (tls as typeof tls & { getCACertificates?: (type: string) => string[] }).getCACertificates;
  return getCertificates ? [...new Set([...getCertificates('default'), ...getCertificates('system')])] : undefined;
}

export function accountMailConfig(env: Record<string, string | undefined> = process.env) {
  const port = Number(env.MAIL_PORT || 587);
  if (!env.MAIL_HOST || !env.MAIL_USERNAME || !env.MAIL_PASSWORD || !env.MAIL_FROM_ADDRESS || !env.APP_URL || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Account email is not configured.');
  }
  const appUrl = new URL(env.APP_URL);
  if (!['http:', 'https:'].includes(appUrl.protocol) || appUrl.username || appUrl.password) throw new Error('Invalid app URL.');
  return {
    options: {
      host: env.MAIL_HOST,
      port,
      secure: port === 465 || ['ssl', 'smtps'].includes(env.MAIL_ENCRYPTION || ''),
      requireTLS: true,
      tls: { ca: trustedCertificates() },
      auth: { user: env.MAIL_USERNAME, pass: env.MAIL_PASSWORD },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
      disableFileAccess: true,
      disableUrlAccess: true,
    },
    from: { name: BRAND.name, address: env.MAIL_FROM_ADDRESS },
    loginUrl: new URL('/login', appUrl).toString(),
  };
}

export function accountEmailText(user: { name: string; email: string; role: string }, password: string, loginUrl: string) {
  return `Hello ${user.name},

Your account at ${BRAND.name} is ready.

Sign in: ${loginUrl}
Email: ${user.email}
Password: ${password}
Access: ${user.role === 'USER' ? 'Customer' : user.role === 'CASHIER' ? 'Cashier' : 'Administrator'}

Keep these login details private. Contact your administrator if you need help.

${BRAND.name}`;
}

export async function sendAccountEmail(user: { name: string; email: string; role: string }, password: string) {
  const config = accountMailConfig();
  const transport = nodemailer.createTransport(config.options);
  try {
    const result = await transport.sendMail({
      from: config.from,
      to: { name: user.name, address: user.email },
      subject: `Your ${BRAND.name} login details`,
      text: accountEmailText(user, password, config.loginUrl),
    });
    if (!result.accepted.length || result.rejected.length) throw new Error('Recipient rejected.');
  } finally {
    transport.close();
  }
}
