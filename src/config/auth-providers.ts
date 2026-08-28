/**
 * Which OAuth providers this deployment can actually complete a sign-in with.
 *
 * WHY THIS EXISTS. `OAuthButtons` rendered "Continue with GitHub" and "Continue
 * with Google" unconditionally, while the live Supabase project had
 * `external_github_enabled: false` and `external_google_enabled: false` — so
 * every press of either button failed at the provider. A control that cannot
 * succeed is worse than an absent one: it reads as a broken product rather than
 * a feature that is not offered, and it is the #287 shape — configured-looking,
 * unusable by a human, green in tests.
 *
 * Enabling a provider needs a secret (`SUPABASE_AUTH_GITHUB_SECRET`,
 * `SUPABASE_AUTH_GOOGLE_SECRET`) that this project does not have (#9), so the
 * honest default is OFF. Every fork of this template starts in the same state,
 * which is the same deny-by-default reasoning as the column grants in #38:
 * a capability appears when someone configures it, not before.
 *
 * BUILD TIME, NOT RUNTIME. This is a static export, so `NEXT_PUBLIC_*` is
 * inlined by Next at build. Each variable is therefore read as a literal
 * `process.env.NEXT_PUBLIC_…` expression — a computed lookup like
 * `process.env[name]` is NOT inlined and silently evaluates to undefined in the
 * browser, which would turn every provider off no matter how it was configured.
 */
export type OAuthProvider = 'github' | 'google';

/** Accepts `true`/`1`; anything else, including unset, is off. */
function enabled(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

export function enabledOAuthProviders(): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  if (enabled(process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED)) {
    providers.push('github');
  }
  if (enabled(process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED)) {
    providers.push('google');
  }
  return providers;
}

/** True when at least one provider can complete a sign-in. */
export function hasOAuthProviders(): boolean {
  return enabledOAuthProviders().length > 0;
}
