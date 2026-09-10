import { describe, it, expect } from 'vitest';
import type { AuthError } from '@supabase/supabase-js';
import {
  passwordChangeErrorMessage,
  PASSWORD_CHANGE_ERROR_CODES,
} from '@/lib/auth/password-change-errors';

/**
 * The codes here are transcribed from gotrue v2.196.0 — the build production runs — at
 * `internal/api/apierrors/errorcode.go:72-76`. They are asserted as literals rather than
 * only through the exported constants, because the constants are what would be wrong if
 * someone "corrected" a spelling: a test that compares a constant to itself passes no
 * matter what the string says.
 */
const err = (code: string, message = 'server text'): AuthError =>
  ({ code, message, name: 'AuthApiError', status: 400 }) as AuthError;

describe('passwordChangeErrorMessage', () => {
  it('uses the wire spelling current_password_invalid, not _mismatch', () => {
    // gotrue's Go constant is ErrorCodeCurrentPasswordMismatch but it carries the string
    // `current_password_invalid` (errorcode.go:75). Deriving the wire value from the
    // constant name yields a comparison that silently never matches.
    expect(PASSWORD_CHANGE_ERROR_CODES.currentPasswordInvalid).toBe(
      'current_password_invalid'
    );
    expect(passwordChangeErrorMessage(err('current_password_invalid'))).toBe(
      'That is not your current password.'
    );
    expect(
      passwordChangeErrorMessage(err('current_password_mismatch'))
    ).toBeNull();
  });

  it('separates a missing current password from a wrong one', () => {
    // gotrue sends byte-identical TEXT for both, so this is the only thing that can.
    const same = 'Current password required when setting new password.';
    expect(
      passwordChangeErrorMessage(err('current_password_required', same))
    ).toBe('Enter your current password to change it.');
    expect(
      passwordChangeErrorMessage(err('current_password_invalid', same))
    ).toBe('That is not your current password.');
  });

  it('tells a stale session what to actually do about it', () => {
    expect(passwordChangeErrorMessage(err('reauthentication_needed'))).toBe(
      'For security, sign out and sign back in, then change your password.'
    );
  });

  it('explains same_password rather than repeating the server', () => {
    expect(passwordChangeErrorMessage(err('same_password'))).toBe(
      'Your new password must be different from your current one.'
    );
  });

  it("returns null so gotrue's more specific text survives", () => {
    // A weak-password rejection names the rule that failed; replacing it with a generic
    // sentence would lose what the user needs to fix.
    expect(passwordChangeErrorMessage(err('weak_password'))).toBeNull();
    expect(
      passwordChangeErrorMessage(err('over_request_rate_limit'))
    ).toBeNull();
  });

  it('survives an error with no code at all', () => {
    // `AuthError.code` is `... | undefined` — errors raised before a response arrives
    // carry no code, and the switch must not throw on them.
    expect(
      passwordChangeErrorMessage({
        message: 'network down',
        name: 'AuthRetryableFetchError',
      } as AuthError)
    ).toBeNull();
  });
});
