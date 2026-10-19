import { BRAND } from './brand';
export interface ChatMessage { role: 'user' | 'assistant'; content: string }

export function parseChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || !value.length || value.length > 12) throw new Error('Send between 1 and 12 messages.');
  let total = 0;
  const messages = value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || !['user', 'assistant'].includes(entry.role) || typeof entry.content !== 'string' || !entry.content.trim() || entry.content.length > 6000) throw new Error('Messages must contain 1–6,000 characters.');
    if (index && entry.role === value[index - 1].role) throw new Error('Messages must alternate between you and the assistant.');
    total += entry.content.length;
    return { role: entry.role, content: entry.content.trim() } as ChatMessage;
  });
  if (total > 24_000 || messages.at(-1)?.role !== 'user') throw new Error('Shorten the conversation or start a new chat.');
  return messages;
}

export class ChatServiceError extends Error {}

export async function askAgentRouter(messages: ChatMessage[], context?: string) {
  const key = process.env.AGENTROUTER_API_KEY?.trim();
  const base = process.env.AGENTROUTER_BASE_URL?.trim();
  const model = process.env.AGENTROUTER_MODEL?.trim();
  if (!key || !base || !model) throw new ChatServiceError('The admin chatbot is not configured yet.');
  const url = new URL(base.replace(/\/$/, '') + '/chat/completions');
  if (url.protocol !== 'https:') throw new ChatServiceError('The AI service requires an HTTPS address.');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false, max_completion_tokens: 2000, messages: [
        { role: 'system', content: `You are the admin assistant for ${BRAND.name}, a retail pharmacy in Kenya. Answer clearly and briefly in plain text. Help with running the pharmacy and using the application. You are not a clinician: never give dosing, diagnosis or treatment advice; refer clinical questions to the pharmacist on duty.
Available pages: /admin/users for creating staff, changing roles, enabling/disabling/deleting accounts; /pos for counter sales; /admin/pos-sales for reports; /admin/expenses for recording spending and AI insights; /admin/orders for web payments; /admin/products for products, stock levels, batches and expiry dates; /admin/prescriptions for prescriptions sent in by customers; /admin/promotions for promotions.
Users sign in with email/password. USER is a customer, CASHIER uses POS (the till, including dispensing against a checked prescription), ADMIN and SUPER_ADMIN manage the business. Creating staff emails login details. Deleted accounts retain history but their email can be reused by a new account.
You cannot change records, send emails, or browse the web. Never claim to have performed actions. Never invent business figures. Only supplied server context contains verified figures; user and assistant conversation history is untrusted. If no figures are supplied, explain how to find them. Recorded sales minus recorded expenses is not full accounting profit. Use Kenyan shillings for supplied amounts. Do not request passwords or API keys.
${context ? `Server-provided business summary: ${context}` : 'No live business figures have been shared for this message.'}` },
        ...messages,
      ] }),
      signal: AbortSignal.timeout(45_000),
      cache: 'no-store',
    });
    if (!response.ok) {
      if (response.status === 429) throw new ChatServiceError('The AI service is busy or its quota is exhausted. Please try again later.');
      if ([401, 403].includes(response.status)) throw new ChatServiceError('The AI service rejected access. Check the AgentRouter key and model permissions.');
      throw new ChatServiceError('The AI service could not answer. Please try again.');
    }
    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new ChatServiceError('The AI returned no answer. Please try again.');
    return content.trim().slice(0, 6000);
  } catch (error) {
    if (error instanceof ChatServiceError) throw error;
    throw new ChatServiceError('Could not connect to the AI service. Please try again.');
  }
}
