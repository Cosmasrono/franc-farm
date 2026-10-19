/** Chat completion through Groq's OpenAI-compatible API, using GROQ_API_KEY. */
export class AiUnavailableError extends Error {}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function askGroq(system: string, user: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new AiUnavailableError('AI is not set up. Add GROQ_API_KEY to .env.');
  const model = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b';
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      // gpt-oss models think before answering; keep that short so insights come back quickly.
      ...(model.startsWith('openai/gpt-oss') && { reasoning_effort: 'low' }),
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    console.error('Groq request failed:', res.status, (await res.text().catch(() => '')).slice(0, 300));
    throw new AiUnavailableError('The AI service did not respond. Please try again in a moment.');
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new AiUnavailableError('The AI service returned an empty answer. Please try again.');
  return content.trim();
}
