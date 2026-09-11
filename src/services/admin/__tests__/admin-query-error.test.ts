/**
 * Admin service failures must reach the UI as real `Error`s (#168).
 *
 * A `PostgrestError` is a plain object, not an `Error`. Every admin page catches with
 * `err instanceof Error ? err.message : '<fallback>'`, so throwing the raw object sends
 * the page down the fallback branch and the server's explanation is discarded.
 *
 * Six sites across four services did `if (error) throw error`. `/admin/users` showed the
 * sentence "Failed to load user data" through three rounds of diagnosis while Postgres had
 * been specific every time (#159 → #169).
 *
 * This pins the CONTRACT rather than the spelling: whatever an admin service throws must
 * survive `instanceof Error` and must still carry the server's text. `throw error` is the
 * shorter line and six people already reached for it, so without a test this comes back.
 */

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { adminQueryError } from '../admin-query-error';
import { AdminUserService } from '../admin-user-service';
import { AdminPaymentService } from '../admin-payment-service';
import { AdminAuditService } from '../admin-audit-service';
import { AdminMessagingService } from '../admin-messaging-service';

const pgError = (over: Partial<PostgrestError> = {}): PostgrestError =>
  ({
    message: 'permission denied for table user_profiles',
    code: '42501',
    details: 'RLS policy rejected the read',
    hint: '',
    name: 'PostgrestError',
    ...over,
  }) as PostgrestError;

describe('adminQueryError', () => {
  it('produces something that survives `instanceof Error`', () => {
    // The whole defect in one assertion: a PostgrestError does not.
    expect(pgError() instanceof Error).toBe(false);
    expect(adminQueryError('admin_user_stats', pgError())).toBeInstanceOf(
      Error
    );
  });

  it("keeps the server's message, which is the part that was being thrown away", () => {
    expect(adminQueryError('admin_user_stats', pgError()).message).toContain(
      'permission denied for table user_profiles'
    );
  });

  it('names the operation, so a concurrent Promise.all is diagnosable', () => {
    // Admin pages fire several calls at once; PostgREST's message rarely says which one
    // failed, and the five already-correct sites did not add it either.
    expect(adminQueryError('admin_list_users', pgError()).message).toContain(
      'admin_list_users'
    );
  });

  it('carries the code, because PostgREST codes point somewhere specific', () => {
    // 42501 insufficient privilege · 42P01 undefined table · PGRST202 no such function
    expect(
      adminQueryError('x', pgError({ code: 'PGRST202' })).message
    ).toContain('PGRST202');
  });

  it('omits an absent code rather than printing undefined', () => {
    const msg = adminQueryError(
      'x',
      pgError({ code: '', details: '' })
    ).message;
    expect(msg).not.toContain('undefined');
    expect(msg).not.toContain('[]');
  });
});

/**
 * Every stats call, driven through its real service with a failing client. These are the
 * six that were wrong; a regression in any one of them reintroduces a page that cannot say
 * why it is empty.
 */
describe('admin services throw real Errors (#168)', () => {
  const failing = () =>
    ({
      rpc: vi.fn(async () => ({ data: null, error: pgError() })),
      from: vi.fn(() => {
        const q: Record<string, unknown> = {};
        for (const m of ['select', 'order', 'limit', 'eq']) {
          q[m] = vi.fn(() => q);
        }
        q.then = (resolve: (v: unknown) => unknown) =>
          resolve({ data: null, error: pgError() });
        return q;
      }),
    }) as unknown as SupabaseClient;

  const cases: Array<[string, () => Promise<unknown>]> = [
    [
      'AdminUserService.getStats',
      async () => {
        const s = new AdminUserService(failing());
        await s.initialize('u1');
        return s.getStats();
      },
    ],
    [
      'AdminPaymentService.getStats',
      async () => {
        const s = new AdminPaymentService(failing());
        await s.initialize('u1');
        return s.getStats();
      },
    ],
    [
      'AdminAuditService.getStats',
      async () => {
        const s = new AdminAuditService(failing());
        await s.initialize('u1');
        return s.getStats();
      },
    ],
    [
      'AdminMessagingService.getStats',
      async () => {
        const s = new AdminMessagingService(failing());
        await s.initialize('u1');
        return s.getStats();
      },
    ],
  ];

  for (const [name, run] of cases) {
    it(`${name} throws an Error carrying the server's text`, async () => {
      await expect(run()).rejects.toBeInstanceOf(Error);
      await expect(run()).rejects.toThrow(/permission denied for table/);
    });
  }
});
