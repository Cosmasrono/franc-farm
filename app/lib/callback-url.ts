import { useSyncExternalStore } from 'react';

/** Pages a sign-in or sign-up may send the visitor back to. Anything else falls back to the default landing page. */
const ALLOWED = ['/payment', '/orders', '/pos', '/#shop', '/#prescriptions', '/#orders'];

export function safeCallbackUrl(value: string | null | undefined): string | null {
  return value && ALLOWED.includes(value) ? value : null;
}

const noSubscribe = () => () => {};

/** The page to return to after signing in, read from `?callbackUrl=` (null while server rendering). */
export function useCallbackUrl(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => safeCallbackUrl(new URLSearchParams(window.location.search).get('callbackUrl')),
    () => null,
  );
}
