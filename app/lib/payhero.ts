import axios from 'axios';

export interface PayHeroStkPushParams {
  amount: number;
  phoneNumber: string;
  externalReference: string;
  customerName?: string;
  callbackUrl?: string;
}

export interface PayHeroStkPushResponse {
  success: boolean;
  status: string; // e.g. "QUEUED"
  reference?: string;
  CheckoutRequestID?: string;
  error_message?: string;
  [key: string]: unknown;
}

export interface PayHeroTransactionStatusResponse {
  success?: boolean;
  status?: string; // "SUCCESS", "FAILED", "QUEUED"
  reference?: string;
  CheckoutRequestID?: string;
  provider_reference?: string;
  third_party_reference?: string;
  payment_reference?: string;
  transaction_date?: string;
  amount?: number;
  error_message?: string;
  [key: string]: unknown;
}

export function getPayHeroConfig() {
  const baseUrl = (process.env.PAYHERO_BASE_URL || 'https://backend.payhero.co.ke/api/v2').replace(/\/+$/, '');
  const username = process.env.PAYHERO_API_USERNAME?.trim();
  const password = process.env.PAYHERO_API_PASSWORD?.trim();
  const channelId = process.env.PAYHERO_CHANNEL_ID ? Number(process.env.PAYHERO_CHANNEL_ID.trim()) : undefined;

  let callbackUrl = process.env.PAYHERO_CALLBACK_URL?.trim();
  const appUrl = (process.env.APP_URL || '').replace(/\/+$/, '');

  if (callbackUrl) {
    callbackUrl = callbackUrl.replace(/\$\{APP_URL\}/g, appUrl).replace(/\$APP_URL/g, appUrl);
  } else if (appUrl) {
    callbackUrl = `${appUrl}/api/mpesa/callback`;
  }

  if (!username || !password || !channelId || !Number.isInteger(channelId) || channelId <= 0) {
    throw new Error('PayHero credentials not fully configured. Please set PAYHERO_API_USERNAME, PAYHERO_API_PASSWORD, and PAYHERO_CHANNEL_ID in .env');
  }

  return {
    baseUrl,
    username,
    password,
    channelId,
    callbackUrl,
  };
}

export function getPayHeroAuthHeader(username: string, password: string): string {
  const authString = `${username}:${password}`;
  const base64Auth = Buffer.from(authString).toString('base64');
  return `Basic ${base64Auth}`;
}

export function formatKenyanPhoneNumber(phone: string): string {
  // Strip spaces, dashes, symbols
  let cleaned = phone.replace(/[^0-9+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // PayHero supports 07xxxxxxxx, 01xxxxxxxx, or 2547xxxxxxxx / 2541xxxxxxxx
  // Normalize to 07xxxxxxxx or 01xxxxxxxx for Kenyan standard
  if (cleaned.startsWith('254') && cleaned.length === 12) {
    cleaned = '0' + cleaned.substring(3);
  }

  if (/^[17]\d{8}$/.test(cleaned)) cleaned = '0' + cleaned;
  return cleaned;
}

export async function initiatePayHeroStkPush(params: PayHeroStkPushParams): Promise<PayHeroStkPushResponse> {
  const config = getPayHeroConfig();
  const formattedPhone = formatKenyanPhoneNumber(params.phoneNumber);
  const authHeader = getPayHeroAuthHeader(config.username, config.password);

  const payload: Record<string, unknown> = {
    amount: Math.ceil(params.amount),
    phone_number: formattedPhone,
    channel_id: config.channelId,
    provider: 'm-pesa',
    external_reference: params.externalReference,
  };

  if (params.customerName) {
    payload.customer_name = params.customerName;
  }

  const finalCallbackUrl = params.callbackUrl || config.callbackUrl;
  if (finalCallbackUrl) {
    payload.callback_url = finalCallbackUrl;
  }

  const url = `${config.baseUrl}/payments`;

  const response = await axios.post<PayHeroStkPushResponse>(url, payload, {
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  return response.data;
}

export async function getPayHeroTransactionStatus(reference: string): Promise<PayHeroTransactionStatusResponse | null> {
  if (!reference) return null;

  try {
    const config = getPayHeroConfig();
    const authHeader = getPayHeroAuthHeader(config.username, config.password);
    const url = `${config.baseUrl}/transaction-status?reference=${encodeURIComponent(reference)}`;

    const response = await axios.get<PayHeroTransactionStatusResponse>(url, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    return response.data;
  } catch {
    console.error('PayHero transaction status check failed.');
    return null;
  }
}
