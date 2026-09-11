import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AccountSettings from './AccountSettings';

// Create mock functions we can spy on
const {
  mockRefetch,
  mockRefreshSession,
  mockFrom,
  mockUpsert,
  mockUpsertSelect,
  mockUpsertSingle,
  mockProfileSelect,
  mockUsernameEq,
  mockUsernameNeq,
  mockUsernameLimit,
  mockProfile,
  mockUpdateUser,
  mockReauthenticate,
} = vi.hoisted(() => ({
  mockRefetch: vi.fn(),
  mockRefreshSession: vi.fn(),
  mockFrom: vi.fn(),
  mockUpsert: vi.fn(),
  mockUpsertSelect: vi.fn(),
  mockUpsertSingle: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockUsernameEq: vi.fn(),
  mockUsernameNeq: vi.fn(),
  mockUsernameLimit: vi.fn(),
  // HOISTED ON PURPOSE. This used to be `vi.fn()` created INSIDE the client factory
  // below, so `createClient()` handed back a brand-new spy on every call and no test
  // could ever see what the component sent. That is why nothing caught #136 — a bare
  // `{ password }` and a correct `{ password, current_password }` were equally
  // unobservable.
  mockUpdateUser: vi.fn(),
  mockReauthenticate: vi.fn(),
  mockProfile: {
    id: 'test-user-id',
    username: 'testuser-b',
    display_name: 'Test User',
    bio: 'Test bio',
    avatar_url: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
}));

// Mock the useUserProfile hook to return a loaded state
vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    profile: mockProfile,
    loading: false,
    error: null,
    refetch: mockRefetch,
  }),
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    refreshSession: mockRefreshSession,
  }),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
    },
    from: mockFrom,
  }),
  /**
   * The SINGLETON, which `NonceChallengeModal` imports directly (#166) — `createClient`
   * above does not satisfy it.
   *
   * DELIBERATELY WITHOUT `rpc`. `audit-logger.ts` imports this same singleton and calls
   * `supabase.rpc(...)`; today that throws into its own catch and `logAuthEvent` no-ops,
   * which is the behaviour the ten tests above were written against. Giving this object
   * an `rpc` would quietly switch the audit logger on and change what those tests
   * exercise — so it gets exactly what the modal needs and nothing more.
   */
  supabase: {
    auth: {
      reauthenticate: mockReauthenticate,
    },
  },
}));

describe('AccountSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfile.username = 'testuser-b';

    mockUpdateUser.mockResolvedValue({ error: null });
    mockReauthenticate.mockResolvedValue({ data: {}, error: null });
    mockUsernameLimit.mockResolvedValue({ data: [], error: null });
    mockUsernameNeq.mockReturnValue({ limit: mockUsernameLimit });
    mockUsernameEq.mockReturnValue({ neq: mockUsernameNeq });
    mockProfileSelect.mockReturnValue({ eq: mockUsernameEq });

    mockUpsertSingle.mockResolvedValue({
      data: {
        id: 'test-user-id',
        username: 'existing_user',
        display_name: 'Test User',
        bio: 'Test bio',
      },
      error: null,
    });
    mockUpsertSelect.mockReturnValue({ single: mockUpsertSingle });
    mockUpsert.mockReturnValue({ select: mockUpsertSelect });
    mockFrom.mockReturnValue({
      upsert: mockUpsert,
      select: mockProfileSelect,
    });
  });

  async function getHydratedUsernameInput() {
    const username = screen.getByLabelText('Username');
    await waitFor(() => expect(username).toHaveValue('testuser-b'));
    return username;
  }

  it('renders without crashing', () => {
    render(<AccountSettings />);
    expect(
      screen.getByRole('heading', { name: /profile settings/i })
    ).toBeInTheDocument();
  });

  // Feature 038: Tests for split error states (FR-003)
  it('renders Profile Settings and Change Password forms', () => {
    render(<AccountSettings />);
    expect(
      screen.getByRole('heading', { name: /profile settings/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /change password/i })
    ).toBeInTheDocument();
  });

  it('has separate form submissions for profile and password', () => {
    render(<AccountSettings />);
    const updateProfileBtn = screen.getByRole('button', {
      name: /update profile/i,
    });
    const changePasswordBtn = screen.getByRole('button', {
      name: /change password/i,
    });
    expect(updateProfileBtn).toBeInTheDocument();
    expect(changePasswordBtn).toBeInTheDocument();
  });

  it('keeps an existing hyphenated username eligible for profile updates', async () => {
    render(<AccountSettings />);

    await getHydratedUsernameInput();
    fireEvent.click(screen.getByRole('button', { name: /update profile/i }));

    await waitFor(() => {
      expect(mockUsernameEq).toHaveBeenCalledWith('username', 'testuser-b');
      expect(mockUsernameNeq).toHaveBeenCalledWith('id', 'test-user-id');
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          id: 'test-user-id',
          username: 'testuser-b',
          display_name: 'Test User',
          bio: 'Test bio',
        },
        { onConflict: 'id' }
      );
    });
  });

  it('hydrates and saves a normalized username', async () => {
    render(<AccountSettings />);

    const username = await getHydratedUsernameInput();

    fireEvent.change(username, { target: { value: '  New-User  ' } });
    fireEvent.click(screen.getByRole('button', { name: /update profile/i }));

    await waitFor(() => {
      expect(mockUsernameEq).toHaveBeenCalledWith('username', 'new-user');
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          id: 'test-user-id',
          username: 'new-user',
          display_name: 'Test User',
          bio: 'Test bio',
        },
        { onConflict: 'id' }
      );
    });
  });

  it('blocks an invalid username before writing a profile', async () => {
    render(<AccountSettings />);
    const username = await getHydratedUsernameInput();

    fireEvent.change(username, { target: { value: 'notallowed!' } });
    fireEvent.click(screen.getByRole('button', { name: /update profile/i }));

    expect(
      await screen.findByText(
        'Username can only contain letters, numbers, underscores, and hyphens'
      )
    ).toBeInTheDocument();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('blocks an unavailable username before writing a profile', async () => {
    mockUsernameLimit.mockResolvedValue({
      data: [{ id: 'other-user-id' }],
      error: null,
    });
    render(<AccountSettings />);
    fireEvent.change(await getHydratedUsernameInput(), {
      target: { value: 'taken-name' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update profile/i }));

    expect(
      await screen.findByText('This username is already taken')
    ).toBeInTheDocument();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('saves a blank username as null without checking availability', async () => {
    render(<AccountSettings />);

    fireEvent.change(await getHydratedUsernameInput(), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update profile/i }));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          id: 'test-user-id',
          username: null,
          display_name: 'Test User',
          bio: 'Test bio',
        },
        { onConflict: 'id' }
      );
    });
    expect(mockUsernameEq).not.toHaveBeenCalled();
  });

  it('handles a duplicate-username write race', async () => {
    mockUpsertSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    render(<AccountSettings />);

    fireEvent.change(await getHydratedUsernameInput(), {
      target: { value: 'available-name' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update profile/i }));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          id: 'test-user-id',
          username: 'available-name',
          display_name: 'Test User',
          bio: 'Test bio',
        },
        { onConflict: 'id' }
      );
    });
    expect(
      await screen.findByText('This username is already taken')
    ).toBeInTheDocument();
  });

  // Feature 038: Tests for inline alerts (FR-004, FR-005)
  it('displays profile error inline within Profile Settings card', async () => {
    render(<AccountSettings />);
    // Profile form validation - display name can be empty, but submitting triggers form
    // The inline alert structure exists, just need to verify it has proper ARIA
    const container = document.querySelector('.card-body');
    expect(container).toBeInTheDocument();
  });

  // Feature 038: Test that no bottom-of-page alerts exist (FR-006)
  it('does not render profile or password error alerts on initial render', () => {
    render(<AccountSettings />);
    // No profile or password error/success alerts should be visible initially
    // These are conditionally rendered when profileError, profileSuccess,
    // passwordError, or passwordSuccess states are set
    expect(
      screen.queryByText('Profile updated successfully!')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Password changed successfully!')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Failed to update profile. Please try again.')
    ).not.toBeInTheDocument();
  });
  /**
   * #136 — password change could not succeed for anyone who signed in with a password.
   *
   * Production has `security_update_password_require_current_password` on, and this form
   * sent a bare `{ password }`. gotrue rejected every attempt with
   * `current_password_required`. It was invisible here because the `updateUser` spy was
   * built inside the client factory, so no test could see the request at all — see the
   * note on `mockUpdateUser` above.
   */
  describe('password change sends the current password (#136)', () => {
    const fillPasswordForm = (current: string, next = 'NewPassword123!') => {
      fireEvent.change(screen.getByLabelText('Current Password'), {
        target: { value: current },
      });
      fireEvent.change(screen.getByLabelText('New Password'), {
        target: { value: next },
      });
      fireEvent.change(screen.getByLabelText('Confirm Password'), {
        target: { value: next },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    };

    it('sends current_password alongside the new one', async () => {
      render(<AccountSettings />);
      fillPasswordForm('OldPassword123!');

      await waitFor(() => expect(mockUpdateUser).toHaveBeenCalled());
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: 'NewPassword123!',
        current_password: 'OldPassword123!',
      });
    });

    it('does not call the server at all when the current password is blank', async () => {
      render(<AccountSettings />);
      fillPasswordForm('');

      expect(
        await screen.findByText('Enter your current password to change it.')
      ).toBeInTheDocument();
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    /**
     * The two cases below are the reason this maps on `error.code`. gotrue returns the
     * SAME sentence for both (`user.go:177` and `:184`), so a message-based mapping
     * would tell a user with the wrong password that they had left the field empty.
     */
    it('tells a wrong current password apart from a missing one', async () => {
      mockUpdateUser.mockResolvedValue({
        error: {
          message: 'Current password required when setting new password.',
          code: 'current_password_invalid',
        },
      });
      render(<AccountSettings />);
      fillPasswordForm('WrongPassword123!');

      expect(
        await screen.findByText('That is not your current password.')
      ).toBeInTheDocument();
    });

    it('surfaces a missing-current-password rejection from the server', async () => {
      mockUpdateUser.mockResolvedValue({
        error: {
          message: 'Current password required when setting new password.',
          code: 'current_password_required',
        },
      });
      render(<AccountSettings />);
      fillPasswordForm('OldPassword123!');

      expect(
        await screen.findByText('Enter your current password to change it.')
      ).toBeInTheDocument();
    });

    /**
     * Only reachable on a session older than 24 hours (`user.go:157`).
     *
     * THIS TEST INVERTED WHEN #166 SHIPPED, deliberately. It used to assert the message
     * telling the player to sign out and back in, because that was all there was. Now the
     * challenge opens and collects the emailed code, and that message is what a DISMISSAL
     * falls back to — still true, no longer the outcome.
     */
    it('opens the reauthentication challenge instead of dead-ending', async () => {
      mockUpdateUser.mockResolvedValue({
        error: {
          message: 'Password update requires reauthentication',
          code: 'reauthentication_needed',
        },
      });
      render(<AccountSettings />);
      fillPasswordForm('OldPassword123!');

      expect(await screen.findByLabelText('6-digit code')).toBeInTheDocument();
      // And the code is requested exactly once, because that email comes out of a
      // project-wide budget of two an hour shared with signup confirmations.
      await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(1));
    });

    it('retries with the nonce, keeping the current password alongside it', async () => {
      mockUpdateUser.mockResolvedValue({
        error: {
          message: 'Password update requires reauthentication',
          code: 'reauthentication_needed',
        },
      });
      render(<AccountSettings />);
      fillPasswordForm('OldPassword123!');

      const code = await screen.findByLabelText('6-digit code');
      mockUpdateUser.mockResolvedValue({ error: null });
      fireEvent.change(code, { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      // The retry must carry BOTH: the nonce satisfies reauthentication, and
      // `current_password` satisfies a separate, independent check (`user.go:154` vs
      // `:173`). Dropping either one fails for a different reason.
      await waitFor(() =>
        expect(mockUpdateUser).toHaveBeenLastCalledWith({
          password: 'NewPassword123!',
          current_password: 'OldPassword123!',
          nonce: '123456',
        })
      );
    });

    it('falls back to the sign-out advice when the challenge is dismissed', async () => {
      mockUpdateUser.mockResolvedValue({
        error: {
          message: 'Password update requires reauthentication',
          code: 'reauthentication_needed',
        },
      });
      render(<AccountSettings />);
      fillPasswordForm('OldPassword123!');

      await screen.findByLabelText('6-digit code');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(
        await screen.findByText(
          'For security, sign out and sign back in, then change your password.'
        )
      ).toBeInTheDocument();
    });

    it("keeps gotrue's own text when it is more specific than ours", async () => {
      mockUpdateUser.mockResolvedValue({
        error: {
          message:
            'Password should contain at least one character of each: abcdefg.',
          code: 'weak_password',
        },
      });
      render(<AccountSettings />);
      fillPasswordForm('OldPassword123!');

      expect(
        await screen.findByText(
          'Password should contain at least one character of each: abcdefg.'
        )
      ).toBeInTheDocument();
    });

    it('clears the current-password field on success, not on failure', async () => {
      render(<AccountSettings />);
      fillPasswordForm('OldPassword123!');
      await waitFor(() => expect(mockUpdateUser).toHaveBeenCalled());
      await waitFor(() =>
        expect(screen.getByLabelText('Current Password')).toHaveValue('')
      );

      mockUpdateUser.mockResolvedValue({
        error: {
          message: 'Current password required when setting new password.',
          code: 'current_password_invalid',
        },
      });
      fillPasswordForm('StillWrong123!');
      expect(
        await screen.findByText('That is not your current password.')
      ).toBeInTheDocument();
      // Feature 038 FR-014: fields are NOT cleared on failure, so a typo is fixable.
      expect(screen.getByLabelText('Current Password')).toHaveValue(
        'StillWrong123!'
      );
    });
  });
});
