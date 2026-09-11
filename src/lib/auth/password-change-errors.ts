import type { AuthError } from '@supabase/supabase-js';

/**
 * What gotrue's password-update failures mean, in words a player can act on.
 *
 * THE MESSAGE TEXT CANNOT BE USED TO TELL TWO OF THESE APART. gotrue returns the
 * identical sentence — "Current password required when setting new password." — both
 * when `current_password` is missing and when it is wrong
 * (`internal/api/user.go:177` and `:184` in v2.196.0, the build production runs). Only
 * the error CODE separates them, which is why this maps on `error.code` and never on
 * `error.message`.
 *
 * TWO OF THESE CODES ARE NOT IN auth-js's `ErrorCode` UNION. `error-codes.d.ts` lists
 * `reauthentication_needed`, `same_password` and `weak_password`, but neither
 * current-password code — its own header allows for exactly that: "the server may also
 * return other error codes not included in this list (if the client library is older
 * than the version on the server)." `AuthError.code` is typed
 * `ErrorCode | (string & {}) | undefined`, so comparing against them needs no cast.
 *
 * AND ONE OF THE CODE NAMES IS A TRAP. gotrue's Go constant is
 * `ErrorCodeCurrentPasswordMismatch`, but the string it carries is
 * `current_password_invalid` (`apierrors/errorcode.go:75`). Deriving the wire value from
 * the constant name gives `current_password_mismatch`, which matches nothing and fails
 * silently — the mapping would fall through to the raw gotrue text and the user would be
 * told a wrong password is a missing one.
 */

/** gotrue's `error_code` values this app has something better to say about. */
export const PASSWORD_CHANGE_ERROR_CODES = {
  currentPasswordRequired: 'current_password_required',
  currentPasswordInvalid: 'current_password_invalid',
  reauthenticationNeeded: 'reauthentication_needed',
  samePassword: 'same_password',
} as const;

/**
 * A player-facing sentence for a failed password change, or `null` to use gotrue's own.
 *
 * Returning `null` rather than a catch-all is deliberate: gotrue's text for a weak
 * password enumerates which rule failed, and replacing it with something generic would
 * lose information the user needs.
 */
export function passwordChangeErrorMessage(error: AuthError): string | null {
  switch (error.code) {
    case PASSWORD_CHANGE_ERROR_CODES.currentPasswordRequired:
      return 'Enter your current password to change it.';

    case PASSWORD_CHANGE_ERROR_CODES.currentPasswordInvalid:
      return 'That is not your current password.';

    // Only reachable when the session is older than 24 hours — gotrue skips the
    // reauthentication check entirely for a session created inside that window
    // (`user.go:157`). Signing out and back in is a complete fix from the player's
    // side, so this says so rather than leaving them at a dead end.
    case PASSWORD_CHANGE_ERROR_CODES.reauthenticationNeeded:
      return 'For security, sign out and sign back in, then change your password.';

    case PASSWORD_CHANGE_ERROR_CODES.samePassword:
      return 'Your new password must be different from your current one.';

    default:
      return null;
  }
}
