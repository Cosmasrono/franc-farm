'use client';
import useSWR from 'swr';
export default function PromotionBanner() {
  const { data } = useSWR<{ message?: string }>('/api/promotions', async (url: string) => { const res = await fetch(url); if (!res.ok) return {}; return res.json(); }, { refreshInterval: 60000, shouldRetryOnError: false });
  if (!data?.message) return null;
  return <aside className="bg-[#0e6b5c] text-white text-center px-5 py-3 text-xs tracking-wide">{data.message}</aside>;
}

