export const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const KEY = 'beautycore_ambassador_ref';
export function normalizeReferralCode(value: unknown): string | null {
  const code = String(value ?? '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{2,39}$/.test(code) ? code : null;
}
export function readStoredReferral(value: string | null, now = Date.now()): string | null {
  try {
    const stored = JSON.parse(value ?? 'null');
    if (!stored || !Number.isFinite(stored.expiresAt) || stored.expiresAt <= now) return null;
    return normalizeReferralCode(stored.code);
  } catch { return null; }
}
export function captureReferral(search: string) {
  const code = normalizeReferralCode(new URLSearchParams(search).get('ref'));
  if (!code) return;
  try {
    // First valid link wins for thirty days; reloading never renews the deadline.
    if (!readStoredReferral(localStorage.getItem(KEY))) {
      localStorage.setItem(KEY, JSON.stringify({ code, expiresAt: Date.now() + REFERRAL_TTL_MS }));
    }
  } catch { /* Signup can still use the current URL when browser storage is unavailable. */ }
}
export function getSignupReferral(search: string): string | null {
  try { return readStoredReferral(localStorage.getItem(KEY)) ?? normalizeReferralCode(new URLSearchParams(search).get('ref')); }
  catch { return normalizeReferralCode(new URLSearchParams(search).get('ref')); }
}