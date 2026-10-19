'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Eye, EyeOff, HeartPulse, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import Wordmark from '@/app/components/Wordmark';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { BRAND } from '@/app/lib/brand';
import { useCallbackUrl } from '@/app/lib/callback-url';

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const callbackUrl = useCallbackUrl();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: String(form.get('email') || '').trim(),
        password: form.get('password'),
      });
      if (!result?.ok || result.error) {
        setError('The email or password was not recognised. Please try again.');
        setBusy(false);
        return;
      }
      const session = await fetch('/api/auth/session').then(res => res.json());
      const role = session?.user?.role;
      router.push(callbackUrl || (['ADMIN', 'SUPER_ADMIN'].includes(role) ? '/admin/dashboard' : role === 'CASHIER' ? '/pos' : '/'));
      router.refresh();
    } catch {
      setError('We could not sign you in. Please try again.');
      setBusy(false);
    }
  };

  return (
    <main className="relative isolate min-h-svh bg-[#eef3ef] lg:flex lg:flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[400px] overflow-hidden lg:h-full" aria-hidden="true">
        <Image src="/images/clinic-login.webp" alt="" fill sizes="100vw" preload unoptimized className="object-cover object-[75%_center] lg:object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b3029]/85 via-transparent to-[#0b3029]/10 lg:bg-gradient-to-r lg:from-[#082c25]/65 lg:via-[#082c25]/10 lg:to-transparent" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-5 py-6 sm:px-10 lg:px-16 lg:py-9">
        <div className="rounded-2xl bg-white/95 px-4 py-3 shadow-sm sm:px-5"><Wordmark /></div>
        <Button asChild variant="outline" className="hidden h-11 rounded-full border-white/60 bg-white/95 px-5 text-[#24483d] sm:inline-flex">
          <Link href="/"><ArrowLeft aria-hidden="true" /> Back to pharmacy</Link>
        </Button>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-[1440px] flex-1 items-center gap-8 px-5 pb-8 sm:px-10 lg:grid-cols-[1fr_440px] lg:gap-20 lg:px-16 lg:py-12">
        <section className="flex min-h-[188px] flex-col justify-end text-white lg:min-h-[560px] lg:justify-center" aria-labelledby="care-heading">
          <div className="mb-5 flex items-center gap-2 text-xs font-medium tracking-[0.18em] uppercase text-white/90">
            <span className="flex size-7 items-center justify-center rounded-full border border-white/40 bg-white/10"><HeartPulse className="size-4" aria-hidden="true" /></span>
            Care, connected.
          </div>
          <h2 id="care-heading" className="max-w-lg text-3xl leading-[1.12] font-semibold tracking-tight sm:text-4xl lg:text-6xl">Your health.<br />A little closer.</h2>
          <p className="mt-5 hidden max-w-sm text-base leading-7 text-white/90 lg:block">Everyday essentials, prescription support, and your pharmacy team. All in one place.</p>
          <div className="mt-10 hidden items-center gap-3 border-t border-white/25 pt-6 text-sm text-white/90 lg:flex">
            <ShieldCheck className="size-5" aria-hidden="true" /> A personal space for your pharmacy care
          </div>
        </section>

        <Card className="mx-auto w-full max-w-[440px] gap-0 overflow-hidden rounded-3xl border-white/80 bg-white py-0 shadow-[0_24px_80px_-20px_rgba(10,40,30,0.35)]">
          <CardHeader className="gap-3 px-6 pt-8 pb-7 sm:px-9 sm:pt-9">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-[#d6e9de] bg-[#edf6f0] text-primary"><LockKeyhole className="size-5" aria-hidden="true" /></div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">Your pharmacy account</p>
            <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-[#18392e]">Welcome back</h1>
            <CardDescription className="text-sm leading-6">Sign in to manage your orders and keep up with your prescriptions.</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-7 sm:px-9">
            <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">{error}</p>}
              <div className="space-y-2.5">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required disabled={busy} className="h-12 rounded-xl bg-white text-base md:text-sm" />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required disabled={busy} className="h-12 rounded-xl bg-white pr-12 text-base md:text-sm" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} aria-controls="password" className="absolute top-1 right-1 size-10 rounded-lg text-muted-foreground" disabled={busy}>
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" disabled={busy} className="mt-2 h-12 w-full rounded-xl text-sm font-semibold shadow-sm">
                {busy ? <><LoaderCircle className="animate-spin" aria-hidden="true" /> Signing in…</> : <>Sign in <ArrowRight aria-hidden="true" /></>}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              New to {BRAND.wordmark}?{' '}
              <Link href={callbackUrl ? '/signup?callbackUrl=' + encodeURIComponent(callbackUrl) : '/signup'} className="inline-block py-2 font-semibold text-primary underline-offset-4 hover:underline">Create an account</Link>
            </p>
          </CardContent>
          <CardFooter className="justify-center gap-2 border-t border-border bg-[#f8faf9] px-6 py-5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" /> Your care starts with a personal account
          </CardFooter>
        </Card>
        <Link href="/" className="mx-auto inline-flex items-center gap-2 py-2 text-sm font-medium text-primary sm:hidden"><ArrowLeft className="size-4" aria-hidden="true" /> Back to pharmacy</Link>
      </div>
      <footer className="relative z-10 hidden px-16 pb-7 text-xs text-white/85 lg:block">Medicines · Wellness · Everyday care</footer>
    </main>
  );
}
