import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Turn a Supabase failure into something a caller can actually surface.
 *
 * A `PostgrestError` IS NOT AN `Error`. It is a plain object, so `err instanceof Error`
 * is false for it — and every admin page catches exactly that way:
 *
 *     setError(err instanceof Error ? err.message : 'Failed to load user data');
 *
 * Six call sites across four admin services threw the raw object
 * (`if (error) throw error`), so the pages rendered a fallback sentence written months
 * earlier and discarded what Postgres said. `/admin/users` showed "Failed to load user
 * data" through three rounds of diagnosis while the server had been specific each time
 * (#168, found by #159).
 *
 * IT NAMES THE OPERATION TOO, which even the five correct sites did not. PostgREST's
 * message rarely says which call failed, and an admin page issues several concurrently in
 * one `Promise.all` — so "permission denied for table user_profiles" left the reader
 * guessing between `admin_user_stats` and `admin_list_users`. Two of the six are table reads rather than
 * RPCs, which is why this takes a label rather than deriving one.
 *
 * The code is carried because PostgREST's are diagnostic and each points somewhere
 * different: `42501` insufficient privilege, `42P01` undefined table, `PGRST202` no
 * matching function (a signature or a missing migration), `PGRST301` a JWT problem.
 */
export function adminQueryError(op: string, error: PostgrestError): Error {
  const code = error.code ? ` [${error.code}]` : '';
  const details = error.details ? ` — ${error.details}` : '';
  return new Error(`${op}${code}: ${error.message}${details}`);
}
