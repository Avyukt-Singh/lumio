// Client-side account API (chunk 5A). Thin typed wrappers around the auth
// routes. Every failure resolves to `{ ok: false, code }` with a closed code
// list that maps to calm learner-facing copy via i18n — raw network errors
// surface as `UNAVAILABLE`, never as stack traces.

export interface AccountUser {
  id: string;
  name: string | null;
  email: string; // masked server-side
  ageBand: string | null;
  aiEnabled: boolean;
  guardianConsent: boolean;
}

export type AuthApiCode =
  | 'BAD_REQUEST'
  | 'RATE_LIMITED'
  | 'NEEDS_VERIFICATION'
  | 'BAD_CREDENTIALS'
  | 'LOCKED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_TOO_MANY_ATTEMPTS'
  | 'OTP_RESEND_COOLDOWN'
  | 'TICKET_INVALID'
  | 'RECOVERY_INVALID'
  | 'UNAUTHENTICATED'
  | 'REAUTH_REQUIRED'
  | 'CONFIRMATION_MISMATCH'
  | 'EMAIL_DISABLED'
  | 'SERVER_ERROR'
  | 'UNAVAILABLE';

export type AuthApiResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; code: AuthApiCode; retryAfterSec?: number };

async function post<T>(path: string, body: unknown): Promise<AuthApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; retryAfterSec?: number } & Record<string, unknown>;
    if (json.ok) return { ok: true, data: json as T & Record<string, unknown> };
    return {
      ok: false,
      code: (json.code as AuthApiCode) ?? 'SERVER_ERROR',
      retryAfterSec: typeof json.retryAfterSec === 'number' ? json.retryAfterSec : undefined,
    };
  } catch {
    return { ok: false, code: 'UNAVAILABLE' };
  }
}

async function get<T>(path: string): Promise<AuthApiResult<T>> {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string } & Record<string, unknown>;
    if (json.ok) return { ok: true, data: json as T & Record<string, unknown> };
    return { ok: false, code: (json.code as AuthApiCode) ?? 'SERVER_ERROR' };
  } catch {
    return { ok: false, code: 'UNAVAILABLE' };
  }
}

export interface MeResponse {
  signedIn: boolean;
  unavailable?: boolean;
  user?: AccountUser;
}

export const authApi = {
  me: () => get<MeResponse>('/api/auth/me'),
  capabilities: () =>
    get<{
      email: { mode: 'console' | 'smtp' | 'off'; reason: string };
      ai: { mode: string; reason: string };
      devOutbox: boolean;
    }>('/api/capabilities'),
  signup: (input: { name: string; email: string; password: string; ageBand: string; emailOwner: 'self' | 'guardian' }) =>
    post<{ devCode?: string }>('/api/auth/signup', input),
  verify: (input: { email: string; purpose: 'signup' | 'login' | 'reset'; code: string }) =>
    post<{ recoveryCodes?: string[]; ticket?: string; devCode?: string }>('/api/auth/verify', input),
  login: (input: { email: string; password: string }) =>
    post<{ devCode?: string }>('/api/auth/login', input),
  otpRequest: (input: { email: string; purpose: 'login' | 'reset' }) =>
    post<{ devCode?: string }>('/api/auth/otp/request', input),
  reset: (input: { ticket: string; newPassword: string }) =>
    post('/api/auth/reset', input),
  recovery: (input: { email: string; recoveryCode: string; newPassword?: string }) =>
    post<{ remaining: number }>('/api/auth/recovery', input),
  recoveryRegenerate: (input: { password?: string; otpCode?: string }) =>
    post<{ recoveryCodes: string[] }>('/api/auth/recovery/regenerate', input),
  logout: (all: boolean) => post(`/api/auth/logout${all ? '?all=1' : ''}`, {}),
  delete: (input: { confirmation: string; password?: string; otpCode?: string }) =>
    post('/api/auth/delete', input),
};
