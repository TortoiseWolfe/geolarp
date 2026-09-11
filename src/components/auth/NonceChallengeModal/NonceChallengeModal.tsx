'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface NonceChallengeModalProps {
  /** Whether the modal is visible. Opening it emails a fresh code. */
  isOpen: boolean;
  /** Hands back the 6-digit code so the caller can retry its update. */
  onSubmit: (nonce: string) => void;
  /** Closed without completing. */
  onClose: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Collect the reauthentication code gotrue emails, for a session older than 24 hours.
 *
 * WHEN THIS IS REACHABLE AT ALL, which is rarely, and that shapes everything below.
 * `security_update_password_require_reauthentication` is live `true`, but gotrue skips
 * the nonce entirely for a session created inside 24 hours
 * (`internal/api/user.go:157` in v2.196.0, the build production runs). So a player who
 * signed in today never sees this. Only a long-lived session does — and signing out and
 * back in is a complete fix from their side, which is what `AccountSettings` says while
 * this is closed.
 *
 * IT DOES NOT CALL `updateUser` ITSELF. It hands the nonce back and the caller retries,
 * so the new password never leaves the form that collected it and this component owns
 * exactly one thing. `reauthenticate()` takes no arguments — confirmed at
 * `GoTrueClient.d.ts:194`, `reauthenticate(): Promise<AuthResponse>`.
 *
 * THE EMAIL IS THE SCARCE PART. `rate_limit_email_sent` is **2 per hour, project-wide**
 * and shared with signup confirmations, and there is no custom SMTP — auth mail leaves
 * via Supabase's built-in sender. So the code is requested ONCE per open, never on
 * re-render, and resending is behind a deliberate button that says what it costs. Two
 * users reaching this in the same hour would otherwise starve signup mail for everyone.
 *
 * NOT NAMED `ReAuthModal`. That already exists at `src/components/auth/ReAuthModal/` and
 * is the MESSAGING encryption password — unrelated to Supabase auth
 * (`EncryptionKeyGate.tsx:136`). A second file one capital letter away would be a
 * maintenance trap, and a grep for either would keep returning both.
 *
 * Modelled on `AccountDeletionModal`, not on `ReAuthModal`: its `<dialog>` +
 * `showModal()` gives a native focus trap and Escape handling that a hand-rolled
 * `fixed inset-0` overlay does not, and this repo has no focus-trap library to fall
 * back on.
 *
 * @category auth
 */
export default function NonceChallengeModal({
  isOpen,
  onSubmit,
  onClose,
  className = '',
}: NonceChallengeModalProps) {
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  /** One send per open. A re-render must never cost an email. */
  const requestedRef = useRef(false);

  const requestCode = useCallback(async () => {
    setSending(true);
    setError(null);
    const { error: sendError } = await supabase.auth.reauthenticate();
    setSending(false);

    if (sendError) {
      // The rate limit is the likely one, and it is shared with signup mail — so say
      // that rather than "try again", which invites the exact retry that starves it.
      setError(
        sendError.code === 'over_email_send_rate_limit'
          ? 'Too many emails have been sent recently. Please wait an hour and try again.'
          : sendError.message
      );
      return;
    }
    setStatus(
      'We emailed you a 6-digit code. It may take a few minutes to arrive.'
    );
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
      if (!requestedRef.current) {
        requestedRef.current = true;
        void requestCode();
      }
    } else {
      dialog.close();
    }
  }, [isOpen, requestCode]);

  // Reset on close, because this holds a one-time secret — the same rule
  // AccountDeletionModal follows for its confirmation text.
  useEffect(() => {
    if (!isOpen) {
      setCode('');
      setError(null);
      setStatus(null);
      requestedRef.current = false;
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter the code from your email.');
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <dialog
      ref={dialogRef}
      className={`modal${className ? ` ${className}` : ''}`}
      aria-labelledby="nonce-challenge-title"
      aria-describedby="nonce-challenge-description"
      onClose={onClose}
    >
      <div className="modal-box">
        <h3 id="nonce-challenge-title" className="text-lg font-bold">
          Confirm it&apos;s you
        </h3>
        <p id="nonce-challenge-description" className="py-2">
          You last signed in a while ago, so we need to confirm this change.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="nonce-input" className="label">
            <span className="label-text">6-digit code</span>
          </label>
          <input
            id="nonce-input"
            name="nonce"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="input input-bordered min-h-11 w-full"
            aria-required="true"
            aria-invalid={!!error}
            aria-describedby={error ? 'nonce-error' : undefined}
            disabled={sending}
          />

          {error && (
            <div
              id="nonce-error"
              className="alert alert-error mt-4"
              role="alert"
            >
              <span>{error}</span>
            </div>
          )}

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost min-h-11 min-w-11"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-outline min-h-11 min-w-11"
              onClick={() => void requestCode()}
              disabled={sending}
            >
              {sending ? 'Sending…' : 'Resend code'}
            </button>
            <button
              type="submit"
              className="btn btn-primary min-h-11 min-w-11"
              disabled={sending}
            >
              Confirm
            </button>
          </div>
        </form>

        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {status ?? ''}
        </p>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}
