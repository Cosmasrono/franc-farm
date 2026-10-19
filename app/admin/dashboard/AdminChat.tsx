'use client';

import { useEffect, useRef, useState } from 'react';
import { BRAND } from '@/app/lib/brand';
import { MessageCircle, Send } from 'lucide-react';
import type { ChatMessage } from '@/app/lib/admin-chat';

export default function AdminChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [includeSummary, setIncludeSummary] = useState(false);
  const transcript = useRef<HTMLDivElement>(null);
  useEffect(() => { transcript.current?.scrollTo({ top: transcript.current.scrollHeight }); }, [messages, busy]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setBusy(true);
    setError('');
    try {
      // Keep five complete exchanges and the latest question within the API limits.
      let recent = next.slice(-11);
      while (recent.reduce((size, message) => size + message.content.length, 0) > 24_000 && recent.length > 1) recent = recent.slice(2);
      const response = await fetch('/api/admin/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: recent, includeSummary }), signal: AbortSignal.timeout(60_000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not send your message.');
      if (typeof result.reply !== 'string') throw new Error('The assistant returned an invalid answer.');
      setMessages([...next, { role: 'assistant', content: result.reply }]);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error && err.name !== 'TimeoutError' ? err.message : 'The request timed out. Please try again.');
    } finally { setBusy(false); }
  }

  return <section className="checkout-panel mb-10" aria-labelledby="admin-chat-heading">
    <div className="flex justify-between items-center gap-3">
      <h2 id="admin-chat-heading" className="flex items-center gap-2"><MessageCircle size={22} /> {BRAND.wordmark} admin assistant</h2>
      <button type="button" disabled={busy} className="text-link" onClick={() => { setMessages([]); setDraft(''); setError(''); }}>New chat</button>
    </div>
    <p className="text-sm text-stone-500 mb-4">Ask about managing staff, recording expenses, sales, or running the restaurant.</p>
    <div ref={transcript} role="log" aria-label="Chat conversation" aria-live="polite" className="max-h-96 overflow-y-auto space-y-3 mb-4">
      {!messages.length && <p className="text-sm text-stone-600 py-4">Try “How do I add a cashier?” or share this month&apos;s totals and ask “Where can we reduce spending?”</p>}
      {messages.map((message, index) => <div key={index} className={`rounded-lg p-3 whitespace-pre-wrap break-words text-sm leading-6 ${message.role === 'user' ? 'bg-[#0e6b5c] text-white ml-6' : 'bg-stone-100 text-stone-800 mr-6'}`}><strong className="block text-xs mb-1">{message.role === 'user' ? 'You' : 'Assistant'}</strong>{message.content}</div>)}
      {busy && <p role="status" className="text-sm text-stone-500">Thinking…</p>}
    </div>
    {error && <p role="alert" className="notice">{error} Your message is still below so you can retry.</p>}
    <form onSubmit={send}>
      <label className="flex gap-2 items-center text-sm mb-3"><input type="checkbox" checked={includeSummary} disabled={busy} onChange={(event) => setIncludeSummary(event.target.checked)} /> Share this month&apos;s sales and expense totals</label>
      <label htmlFor="admin-chat-message" className="sr-only">Your message</label>
      <textarea id="admin-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={6000} rows={3} disabled={busy} required placeholder="Ask the admin assistant…" className="w-full border border-stone-300 rounded-lg p-3 text-sm" />
      <div className="flex justify-between items-center gap-4 mt-3">
        <p className="text-xs text-stone-500">Messages go to the AI service. Keep passwords and personal details out of chat. Answers may need checking. Chat clears when you leave this page.</p>
        <button className="shop-button flex items-center gap-2" disabled={busy || !draft.trim()}><Send size={16} /> {busy ? 'Sending…' : 'Send'}</button>
      </div>
    </form>
  </section>;
}
