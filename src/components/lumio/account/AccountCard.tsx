'use client';

// Account UI surfaces (chunk 5A): the header badge, the account card for
// Settings, and the "different account on this device" prompt. All three wrap
// AccountFlow views so every flow renders identically wherever it opens.
import { useState, type ReactNode } from 'react';
import { CircleUserRound, LogIn, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AccountFlow } from './AccountFlow';
import { tFor } from '@/lib/lumio/i18n';
import { authApi, type AccountUser } from '@/lib/lumio/accountClient';
import type { UiLang } from '@/lib/lumio/i18n';

type Avail = 'unknown' | 'ok' | 'unavailable';

interface AccountUiProps {
  lang: UiLang;
  user: AccountUser | null;
  avail: Avail;
  devOutbox: boolean;
  onSignedIn: (u: AccountUser) => void;
  onSignedOut: () => void;
  onDeleted: () => void;
}

/** Small, honest header indicator: signed out / signed in / offline. */
export function AccountBadge(props: AccountUiProps) {
  const tr = tFor(props.lang);
  const [open, setOpen] = useState(false);
  const [flowKey, setFlowKey] = useState(0);

  if (props.avail === 'unavailable') {
    return (
      <span
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-muted-foreground"
        title={tr('account.unavailable')}
      >
        <WifiOff className="size-4" aria-hidden="true" />
        <span className="sr-only">{tr('account.unavailable')}</span>
      </span>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setFlowKey((k) => k + 1); // fresh flow state each open
      }}
    >
      <DialogTrigger asChild>
        <button
          className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          aria-label={props.user ? `${tr('account.signedInAs')}: ${props.user.name ?? ''}` : tr('account.signedOutBadge')}
        >
          {props.user ? (
            <>
              <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary"
              >
                {(props.user.name ?? 'L').slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-[8rem] truncate sm:inline">{props.user.name ?? tr('account.signedInAs')}</span>
            </>
          ) : (
            <>
              <LogIn className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{tr('account.signedOutBadge')}</span>
            </>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr('account.title')}</DialogTitle>
          <DialogDescription>{tr('account.subtitle')}</DialogDescription>
        </DialogHeader>
        <AccountFlow
          key={flowKey}
          lang={props.lang}
          devOutbox={props.devOutbox}
          user={props.user}
          initialView={props.user ? 'manage' : 'entry'}
          initialTab="signin"
          onSignedIn={(u) => {
            setOpen(false);
            props.onSignedIn(u);
          }}
          onSignedOut={() => {
            setOpen(false);
            props.onSignedOut();
          }}
          onDeleted={() => {
            setOpen(false);
            props.onDeleted();
          }}
          compact
        />
      </DialogContent>
    </Dialog>
  );
}

/** Settings > Account card: signed-in actions or the honest unavailable note. */
export function AccountSettingsCard(props: AccountUiProps & { slot?: ReactNode }) {
  const tr = tFor(props.lang);
  const [open, setOpen] = useState(false);
  const [flowKey, setFlowKey] = useState(0);

  return (
    <section aria-labelledby="set-account" data-tour="settings-account" className="rounded-2xl border border-border bg-card p-5">
      <h2 id="set-account" className="mb-1 flex items-center gap-2 font-heading text-lg font-semibold">
        <CircleUserRound className="size-5 text-primary" aria-hidden="true" /> {tr('account.title')}
      </h2>
      {props.avail === 'unavailable' ? (
        <p className="mt-2 text-sm text-muted-foreground">{tr('account.unavailable')}</p>
      ) : props.user ? (
        <>
          <p className="mt-2 text-sm">
            {tr('account.signedInAs')}: <b>{props.user.name ?? '—'}</b>{' '}
            <span className="text-muted-foreground">({props.user.email})</span>
          </p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              setFlowKey((k) => k + 1);
              setOpen(true);
            }}
          >
            {tr('account.title')}
          </Button>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (o) setFlowKey((k) => k + 1);
            }}
          >
            <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{tr('account.title')}</DialogTitle>
                <DialogDescription>{tr('account.regenerateLead')}</DialogDescription>
              </DialogHeader>
              <AccountFlow
                key={flowKey}
                lang={props.lang}
                devOutbox={props.devOutbox}
                user={props.user}
                initialView="manage"
                onSignedIn={props.onSignedIn}
                onSignedOut={() => {
                  setOpen(false);
                  props.onSignedOut();
                }}
                onDeleted={() => {
                  setOpen(false);
                  props.onDeleted();
                }}
                compact
              />
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{tr('account.subtitle')}</p>
          <Button
            className="mt-3"
            onClick={() => {
              setFlowKey((k) => k + 1);
              setOpen(true);
            }}
          >
            <LogIn className="size-4" aria-hidden="true" /> {tr('account.signedOutBadge')}
          </Button>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (o) setFlowKey((k) => k + 1);
            }}
          >
            <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{tr('account.title')}</DialogTitle>
                <DialogDescription>{tr('account.subtitle')}</DialogDescription>
              </DialogHeader>
              <AccountFlow
                key={flowKey}
                lang={props.lang}
                devOutbox={props.devOutbox}
                initialView="entry"
                initialTab="create"
                onSignedIn={(u) => {
                  setOpen(false);
                  props.onSignedIn(u);
                }}
                compact
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
}

/** Ask what to do when another account signs in on a device holding data. */
export function DevicePrompt({
  lang,
  onKeep,
  onFresh,
}: {
  lang: UiLang;
  onKeep: () => void;
  onFresh: () => void;
}) {
  const tr = tFor(lang);
  return (
    <Dialog open modal>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr('account.devicePromptTitle')}</DialogTitle>
          <DialogDescription>{tr('account.devicePromptBody')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button onClick={onKeep} className="min-h-[44px]">
            {tr('account.deviceKeep')}
          </Button>
          <Button variant="destructive" onClick={onFresh} className="min-h-[44px]">
            {tr('account.deviceFresh')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
