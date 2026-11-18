'use client';

// Account flow (chunk 5A, ADR 0004): create account, verify (6-digit OTP),
// code sign-in, forgot password, recovery codes, account management.
// One component renders every view so copy, states and i18n stay consistent.
// All server contact goes through authApi; failures resolve to calm copy via
// the account.err.* i18n keys — never a stack trace, never enumeration.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, KeyRound, LogOut, ShieldQuestion, Trash2, Copy, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';
import { tFor, type UiLang } from '@/lib/lumio/i18n';
import { BANDS, type Band } from '@/lib/lumio/content';
import { authApi, type AccountUser, type AuthApiCode } from '@/lib/lumio/accountClient';

type View = 'entry' | 'verify' | 'recovery' | 'forgot' | 'newpass' | 'manage' | 'done';
type EntryTab = 'create' | 'signin';
type VerifyPurpose = 'signup' | 'login' | 'reset';

const RESEND_COOLDOWN_SEC = 60;
const MAX_CODE_ATTEMPTS = 5;

export function AccountFlow({
  lang,
  devOutbox,
  onSignedIn,
  onSignedOut,
  onDeleted,
  user,
  initialView = 'entry',
  initialTab = 'create',
  compact,
}: {
  lang: UiLang;
  /** True when GET /api/capabilities says the dev console email adapter is on. */
  devOutbox?: boolean;
  onSignedIn?: (user: AccountUser) => void;
  onSignedOut?: () => void;
  onDeleted?: () => void;
  /** Signed-in user when rendering `manage` from Settings. */
  user?: AccountUser | null;
  initialView?: View;
  initialTab?: EntryTab;
  compact?: boolean;
}) {
  const tr = tFor(lang) as (key: string) => string;
  const [view, setView] = useState<View>(initialView);
  const [tab, setTab] = useState<EntryTab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ---- carried context between views ----
  const [email, setEmail] = useState('');
  const [purpose, setPurpose] = useState<VerifyPurpose>('signup');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [ticket, setTicket] = useState<string | null>(null);

  // ---- create-account form ----
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [ageBand, setAgeBand] = useState<Band>('sec');
  const [emailOwner, setEmailOwner] = useState<'self' | 'guardian' | null>(null);
  const [selfConfirm, setSelfConfirm] = useState(false);
  const [fieldErr, setFieldErr] = useState<{ name?: string; email?: string; password?: string; owner?: string }>({});

  // ---- verify state ----
  const [code, setCode] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // countdown driver (interval callback — never synchronous in an effect body)
  const counting = resendIn > 0;
  useEffect(() => {
    if (!counting) return;
    const t = setInterval(() => {
      setResendIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [counting]);

  const startCooldown = () => setResendIn(RESEND_COOLDOWN_SEC);

  const fill = (e: string) => setEmail(e.trim());

  const goVerify = (p: VerifyPurpose, devCodeIn?: string) => {
    setPurpose(p);
    setDevCode(devCodeIn ?? null);
    setCode('');
    setAttempts(0);
    setError(null);
    setView('verify');
    startCooldown();
  };

  const refreshMeAndFinish = async () => {
    const me = await authApi.me();
    if (me.ok && me.data.signedIn && me.data.user) {
      onSignedIn?.(me.data.user);
    }
    setView('done');
    setNotice(null);
  };

  const sendCode = async (p: VerifyPurpose) => {
    setBusy(true);
    setError(null);
    const res = await authApi.otpRequest({ email, purpose: p === 'reset' ? 'reset' : 'login' });
    setBusy(false);
    if (!res.ok) {
      setError(errCopy(tr, res.code));
      return;
    }
    setDevCode(res.data.devCode ?? null);
    setCode('');
    setAttempts(0);
    startCooldown();
  };

  const submitCode = async (value: string) => {
    setBusy(true);
    setError(null);
    const res = await authApi.verify({ email, purpose, code: value });
    setBusy(false);
    if (!res.ok) {
      const nextAttempt = attempts + 1;
      setAttempts(nextAttempt);
      if (res.code === 'OTP_EXPIRED' || res.code === 'OTP_TOO_MANY_ATTEMPTS') {
        setError(tr('account.verifyDead'));
        setAttempts(0);
      } else if (res.code === 'OTP_INVALID') {
        setError(
          nextAttempt >= MAX_CODE_ATTEMPTS
            ? tr('account.verifyDead')
            : tr('account.verifyAttempts').replace('{n}', String(MAX_CODE_ATTEMPTS - nextAttempt))
        );
      } else {
        setError(errCopy(tr, res.code));
      }
      setCode('');
      return;
    }
    const data = res.data;
    if (purpose === 'reset' && data.ticket) {
      setTicket(data.ticket);
      setView('newpass');
      return;
    }
    if (purpose === 'signup' && data.recoveryCodes) {
      setRecoveryCodes(data.recoveryCodes);
      setView('recovery');
      return;
    }
    // login purpose (and login-shaped flows) -> signed in
    await refreshMeAndFinish();
  };

  // ---- create account ----
  const submitCreate = async () => {
    const errs: typeof fieldErr = {};
    if (!name.trim()) errs.name = tr('account.name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = tr('account.email');
    if (password.length < 8) errs.password = tr('account.strengthWeak');
    if (!emailOwner) errs.owner = tr('account.whoseEmail');
    if (emailOwner === 'self' && (ageBand === 'young' || ageBand === 'middle') && !selfConfirm) {
      errs.owner = tr('account.emailMineConfirm');
    }
    setFieldErr(errs);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    setError(null);
    const res = await authApi.signup({
      name: name.trim(),
      email: email.trim(),
      password,
      ageBand,
      emailOwner: emailOwner ?? 'guardian',
    });
    setBusy(false);
    if (!res.ok) {
      setError(errCopy(tr, res.code));
      return;
    }
    goVerify('signup', res.data.devCode);
  };

  // ---- sign in ----
  const submitLogin = async () => {
    setBusy(true);
    setError(null);
    const res = await authApi.login({ email: email.trim(), password });
    setBusy(false);
    if (!res.ok) {
      setError(errCopy(tr, res.code));
      return;
    }
    await refreshMeAndFinish();
  };

  // ---- forgot password ----
  const submitForgot = async () => {
    setBusy(true);
    setError(null);
    const res = await authApi.otpRequest({ email: email.trim(), purpose: 'reset' });
    setBusy(false);
    if (!res.ok) {
      setError(errCopy(tr, res.code));
      return;
    }
    setPurpose('reset');
    setDevCode(res.data.devCode ?? null);
    setCode('');
    setAttempts(0);
    setView('verify');
    startCooldown();
  };

  const submitNewPass = async (newPassword: string) => {
    if (!ticket) return;
    setBusy(true);
    setError(null);
    const res = await authApi.reset({ ticket, newPassword });
    setBusy(false);
    if (!res.ok) {
      setError(errCopy(tr, res.code));
      return;
    }
    setTicket(null);
    setNotice(tr('account.resetDone'));
    setView('entry');
    setTab('signin');
  };

  // ---- account management (Settings) ----
  const [reauthPass, setReauthPass] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePass, setDeletePass] = useState('');

  const signOut = async (all: boolean) => {
    setBusy(true);
    await authApi.logout(all);
    setBusy(false);
    onSignedOut?.();
  };

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    const res = await authApi.recoveryRegenerate({ password: reauthPass });
    setBusy(false);
    if (!res.ok) {
      setError(errCopy(tr, res.code));
      return;
    }
    setRecoveryCodes(res.data.recoveryCodes);
    setReauthPass('');
    setView('recovery');
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError(null);
    const res = await authApi.delete({ confirmation: deleteConfirm.trim(), password: deletePass || undefined });
    setBusy(false);
    if (!res.ok) {
      setError(errCopy(tr, res.code));
      return;
    }
    setDeleteOpen(false);
    setDeleteConfirm('');
    setDeletePass('');
    onDeleted?.();
  };

  const strength = password.length === 0 ? null : password.length < 8 ? 'weak' : password.length < 12 ? 'ok' : 'strong';

  const bandChoices = useMemo(() => (Object.keys(BANDS) as Band[]).map((b) => ({ id: b, name: BANDS[b].name })), []);

  // ---- views ----

  if (view === 'verify') {
    const masked = maskLocal(email);
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-heading text-lg font-bold">
            <KeyRound className="size-5 text-primary" aria-hidden="true" /> {tr('account.verifyTitle')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr('account.verifyLead').replace('{email}', masked)}
          </p>
        </div>
        {devOutbox && (
          <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {tr('account.verifyDevNotice')}
            {devCode && <span className="ml-2 font-mono text-base font-bold tabular-nums text-foreground">{devCode}</span>}
          </p>
        )}
        <form
          className="flex flex-col items-center gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) void submitCode(code);
          }}
        >
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(v) => {
              setCode(v);
              if (v.length === 6) void submitCode(v);
            }}
            autoComplete="one-time-code"
            inputMode="numeric"
            aria-label={tr('account.verifyTitle')}
            disabled={busy}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          <p aria-live="polite" className={cn('min-h-[1.25rem] text-sm', error ? 'text-destructive' : 'text-muted-foreground')}>
            {error ?? ''}
          </p>
          {resendIn > 0 ? (
            <p className="text-sm text-muted-foreground tabular-nums">
              {tr('account.verifyResendIn').replace('{secs}', String(resendIn))}
            </p>
          ) : (
            <Button type="button" variant="secondary" onClick={() => void sendCode(purpose)} disabled={busy}>
              <RefreshCw className="size-4" aria-hidden="true" /> {tr('account.verifyResend')}
            </Button>
          )}
        </form>
        <Button variant="ghost" onClick={() => { setView('entry'); setError(null); }}>
          {tr('account.wrongEmail')}
        </Button>
      </div>
    );
  }

  if (view === 'recovery') {
    const text = `Lumio recovery codes (each works once)\n${recoveryCodes.join('\n')}`;
    return (
      <div className="flex flex-col gap-4">
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold">
          <ShieldQuestion className="size-5 text-primary" aria-hidden="true" /> {tr('account.recoveryTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">{tr('account.recoveryLead')}</p>
        <div
          className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-4 sm:grid-cols-4"
          role="list"
          aria-label={tr('account.recoveryTitle')}
        >
          {recoveryCodes.map((c) => (
            <span key={c} role="listitem" className="font-mono text-sm font-semibold tabular-nums tracking-wider">
              {c}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => void navigator.clipboard.writeText(text).catch(() => undefined)}
          >
            <Copy className="size-4" aria-hidden="true" /> {tr('account.recoveryCopy')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const blob = new Blob([text], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'lumio-recovery-codes.txt';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="size-4" aria-hidden="true" /> {tr('common.download')}
          </Button>
        </div>
        <label className="flex min-h-[44px] items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            className="size-5 accent-[var(--primary)]"
            aria-label={tr('account.recoverySaved')}
            id="recovery-ack"
          />
          {tr('account.recoverySaved')}
        </label>
        <Button onClick={() => void refreshMeAndFinish()} disabled={busy}>
          {tr('account.recoveryContinue')}
        </Button>
      </div>
    );
  }

  if (view === 'newpass') {
    return (
      <NewPassView
        tr={tr}
        busy={busy}
        error={error}
        onSubmit={(p) => void submitNewPass(p)}
      />
    );
  }

  if (view === 'forgot') {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="font-heading text-lg font-bold">{tr('account.forgotTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{tr('account.forgotLead')}</p>
        </div>
        <Field label={tr('account.email')}>
          <Input
            type="email"
            value={email}
            onChange={(e) => fill(e.target.value)}
            autoComplete="email"
            inputMode="email"
          />
        </Field>
        {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
        <Button onClick={() => void submitForgot()} disabled={busy || email.length < 3} className="min-h-[44px]">
          {tr('account.forgotCta')}
        </Button>
        <Button variant="ghost" onClick={() => setView('entry')}>{tr('common.back')}</Button>
      </div>
    );
  }

  if (view === 'manage' && user) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="font-heading text-lg font-bold">{tr('account.title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr('account.signedInAs')}: <b>{user.name ?? '—'}</b> ({user.email})
          </p>
        </div>
        {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
        <div>
          <Label htmlFor="reauth-pass">{tr('account.regenerateLead')}</Label>
          <div className="mt-1 flex gap-2">
            <Input
              id="reauth-pass"
              type="password"
              value={reauthPass}
              onChange={(e) => setReauthPass(e.target.value)}
              autoComplete="current-password"
            />
            <Button onClick={() => void regenerate()} disabled={busy || reauthPass.length < 8} className="min-h-[44px]">
              <RefreshCw className="size-4" aria-hidden="true" /> {tr('account.regenerate')}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void signOut(false)} disabled={busy} className="min-h-[44px]">
            <LogOut className="size-4" aria-hidden="true" /> {tr('account.signOut')}
          </Button>
          <Button variant="secondary" onClick={() => void signOut(true)} disabled={busy} className="min-h-[44px]">
            <LogOut className="size-4" aria-hidden="true" /> {tr('account.signOutAll')}
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={busy} className="min-h-[44px]">
            <Trash2 className="size-4" aria-hidden="true" /> {tr('account.deleteCta')}
          </Button>
        </div>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tr('account.deleteCta')}</AlertDialogTitle>
              <AlertDialogDescription>{tr('account.deleteLead')}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-3">
              <Field label={tr('account.deleteConfirm')}>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  aria-label={tr('account.deleteConfirm')}
                  autoComplete="off"
                />
              </Field>
              <Field label={tr('account.deleteReauth')}>
                <Input
                  type="password"
                  value={deletePass}
                  onChange={(e) => setDeletePass(e.target.value)}
                  aria-label={tr('account.deleteReauth')}
                  autoComplete="current-password"
                />
              </Field>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{tr('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void deleteAccount();
                }}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {tr('account.deleteCta')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (view === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <p className="font-heading text-lg font-bold">{tr('account.welcome')}</p>
        <p className="text-sm text-muted-foreground">{notice ?? tr('account.signedInToast')}</p>
      </div>
    );
  }

  // ---- entry (create / signin tabs) ----
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={tr('account.title')} className="grid grid-cols-2 gap-2">
        {(['create', 'signin'] as EntryTab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => { setTab(t); setError(null); }}
            className={cn(
              'press min-h-[44px] rounded-xl border-2 px-3 text-sm font-semibold',
              tab === t ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
            )}
          >
            {t === 'create' ? tr('account.tabCreate') : tr('account.tabSignin')}
          </button>
        ))}
      </div>

      {!compact && <p className="text-xs text-muted-foreground">{tr('account.subtitle')}</p>}

      <Field label={tr('account.email')} err={fieldErr.email}>
        <Input
          type="email"
          value={email}
          onChange={(e) => fill(e.target.value)}
          autoComplete="email"
          inputMode="email"
        />
      </Field>

      {tab === 'create' && (
        <>
          <Field label={tr('account.name')} err={fieldErr.name} hint={tr('account.nameHint')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
          </Field>
          <Field label={tr('account.password')} err={fieldErr.password}>
            <PassInput value={password} onChange={setPassword} show={showPass} toggle={() => setShowPass((s) => !s)} tr={tr} autoComplete="new-password" />
            {strength && (
              <p className="mt-1 text-xs text-muted-foreground">
                {strength === 'weak' ? tr('account.strengthWeak') : strength === 'ok' ? tr('account.strengthOk') : tr('account.strengthStrong')}
              </p>
            )}
          </Field>
          <Field label={tr('account.ageBand')}>
            <div role="radiogroup" aria-label={tr('account.ageBand')} className="flex flex-wrap gap-2">
              {bandChoices.map((b) => (
                <button
                  key={b.id}
                  role="radio"
                  aria-checked={ageBand === b.id}
                  onClick={() => setAgeBand(b.id)}
                  className={cn(
                    'press min-h-[44px] rounded-xl border-2 px-3 text-sm font-medium',
                    ageBand === b.id ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </Field>
          <Field label={tr('account.whoseEmail')} err={fieldErr.owner}>
            <div role="radiogroup" aria-label={tr('account.whoseEmail')} className="grid grid-cols-2 gap-2">
              {(['self', 'guardian'] as const).map((o) => (
                <button
                  key={o}
                  role="radio"
                  aria-checked={emailOwner === o}
                  onClick={() => setEmailOwner(o)}
                  className={cn(
                    'press min-h-[44px] rounded-xl border-2 px-3 text-sm font-medium',
                    emailOwner === o ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  {o === 'self' ? tr('account.emailMine') : tr('account.emailGuardian')}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{tr('account.emailGuardianNote')}</p>
            {emailOwner === 'self' && (ageBand === 'young' || ageBand === 'middle') && (
              <label className="mt-2 flex min-h-[44px] items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={selfConfirm}
                  onChange={(e) => setSelfConfirm(e.target.checked)}
                  className="size-5"
                  aria-label={tr('account.emailMineConfirm')}
                />
                {tr('account.emailMineConfirm')}
              </label>
            )}
          </Field>
          <p className="text-xs text-muted-foreground">{tr('account.privacyLine')}</p>
          {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
          <Button onClick={() => void submitCreate()} disabled={busy} className="min-h-[44px]">
            {tr('account.createCta')}
          </Button>
          <LinkButton label={tr('account.forgot')} onClick={() => setView('forgot')} />
        </>
      )}

      {tab === 'signin' && (
        <>
          <Field label={tr('account.password')}>
            <PassInput value={password} onChange={setPassword} show={showPass} toggle={() => setShowPass((s) => !s)} tr={tr} autoComplete="current-password" />
          </Field>
          {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={() => void submitLogin()}
            disabled={busy || !email.includes('@') || password.length < 1}
            className="min-h-[44px]"
          >
            {tr('account.signinCta')}
          </Button>
          <LinkButton
            label={tr('account.codeInstead')}
            onClick={async () => {
              if (!email.includes('@')) {
                setError(errCopy(tr, 'BAD_REQUEST'));
                return;
              }
              setBusy(true);
              const res = await authApi.otpRequest({ email: email.trim(), purpose: 'login' });
              setBusy(false);
              if (!res.ok) {
                setError(errCopy(tr, res.code));
                return;
              }
              goVerify('login', res.data.devCode);
            }}
          />
          <LinkButton label={tr('account.forgot')} onClick={() => setView('forgot')} />
        </>
      )}
    </div>
  );
}

function errCopy(tr: (k: string) => string, code: AuthApiCode | 'BAD_REQUEST'): string {
  return tr(`account.err.${code}`);
}

function PassInput({
  value, onChange, show, toggle, tr, autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggle: () => void;
  tr: (k: string) => string;
  autoComplete: string;
}) {
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="pr-10"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={show ? tr('account.passwordHide') : tr('account.passwordShow')}
        className="press absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

function LinkButton({ label, onClick }: { label: string; onClick: () => void | Promise<void> }) {
  return (
    <button
      type="button"
      className="press min-h-[44px] text-left text-sm font-medium text-primary underline-offset-2 hover:underline"
      onClick={() => void onClick()}
    >
      {label}
    </button>
  );
}

function NewPassView({
  tr, busy, error, onSubmit,
}: {
  tr: (k: string) => string;
  busy: boolean;
  error: string | null;
  onSubmit: (p: string) => void;
}) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const mismatch = p2.length > 0 && p1 !== p2;
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-heading text-lg font-bold">{tr('account.newPassTitle')}</h3>
      <Field label={tr('account.password')}>
        <Input type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" />
      </Field>
      <Field label={tr('account.password')}>
        <Input
          type="password"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
          autoComplete="new-password"
          aria-invalid={mismatch}
        />
      </Field>
      {mismatch && <p className="text-sm text-destructive">{tr('account.err.BAD_REQUEST')}</p>}
      {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
      <Button onClick={() => onSubmit(p1)} disabled={busy || p1.length < 8 || p1 !== p2}>
        {tr('account.newPassCta')}
      </Button>
    </div>
  );
}

function Field({
  label, err, hint, children,
}: {
  label: string;
  err?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
    </div>
  );
}

/** Mask the local part for display: a•••v@… — never shows the full address. */
function maskLocal(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '•••';
  return `${email[0]}•••${email[at - 1]}${email.slice(at)}`;
}
