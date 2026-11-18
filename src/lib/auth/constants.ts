// Auth constants (chunk 5A). String "enums" for SQLite plus the tunables
// that the OTP/session flows share. Times are in ms unless named otherwise.

export const OTP_PURPOSE = {
  signup: 'signup',
  login: 'login',
  reset: 'reset',
  delete: 'delete',
} as const;
export type OtpPurpose = (typeof OTP_PURPOSE)[keyof typeof OTP_PURPOSE];

export const EMAIL_OWNER = {
  self: 'self',
  guardian: 'guardian',
} as const;

export const OTP = {
  /** Code lifetime. Shortened via OTP_TTL_MS env for verification runs. */
  ttlMs: 10 * 60 * 1000,
  /** Attempts before the code dies. */
  maxAttempts: 5,
  /** One code per (email, purpose): a new send invalidates the old one. */
  resendCooldownMs: 60 * 1000,
  /** Sends per email per hour. */
  sendsPerEmailPerHour: 5,
  /** Sends per ip-hash per hour. */
  sendsPerIpPerHour: 20,
  digits: 6,
} as const;

export const SESSION = {
  cookie: 'lumio_session',
  /** 30 days; slides forward when lastSeenAt is refreshed (at most hourly). */
  ttlMs: 30 * 24 * 60 * 60 * 1000,
  /** Minimum gap between lastSeenAt refreshes. */
  touchGapMs: 60 * 60 * 1000,
} as const;

export const PASSWORD = {
  minLength: 8,
  maxLength: 128,
} as const;

export const LOCKOUT = {
  maxFailedAttempts: 5,
  durationMs: 15 * 60 * 1000,
} as const;

export const RECOVERY = {
  /** 8 codes of XXXX-XXXX from an unambiguous alphabet (no 0/O/1/I). */
  count: 8,
  alphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
} as const;

export const LIMITS = {
  /** Max JSON body bytes accepted on auth routes. */
  bodyBytes: 8 * 1024,
  /** Hourly reset-window limiter buckets. */
  hourMs: 60 * 60 * 1000,
} as const;
