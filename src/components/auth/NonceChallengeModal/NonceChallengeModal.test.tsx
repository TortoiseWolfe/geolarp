import { StrictMode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NonceChallengeModal from './NonceChallengeModal';

const { mockReauthenticate } = vi.hoisted(() => ({
  mockReauthenticate: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { reauthenticate: mockReauthenticate } },
}));

/**
 * The email budget is the thing worth pinning here (#166).
 *
 * `rate_limit_email_sent` is 2 per hour, PROJECT-WIDE, shared with signup confirmations,
 * and there is no custom SMTP. So "requests a code once per open" is not a performance
 * nicety — a re-render that costs an email would let two users starve sign-up mail for
 * everyone.
 */
describe('NonceChallengeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReauthenticate.mockResolvedValue({ data: {}, error: null });
  });

  const props = () => ({
    isOpen: true,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
  });

  it('requests a code when it opens', async () => {
    render(<NonceChallengeModal {...props()} />);
    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(1));
  });

  it('does NOT request another code on re-render', async () => {
    const p = props();
    const { rerender } = render(<NonceChallengeModal {...p} />);
    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(1));

    rerender(<NonceChallengeModal {...p} className="changed" />);
    rerender(<NonceChallengeModal {...p} className="again" />);

    // Still one. Each extra call is an email out of a project-wide budget of two an hour.
    //
    // NOTE ON WHAT THIS DOES AND DOES NOT PROVE. React's effect deps already stop a
    // className change re-running the effect, so this passes with or without the
    // `requestedRef` guard — I removed the guard to check, and it stayed green. The guard
    // earns its place against StrictMode's double-invoked mount effect, which is the test
    // below. Keeping both because they fail for different reasons.
    expect(mockReauthenticate).toHaveBeenCalledTimes(1);
  });

  it('sends one code under StrictMode, which double-invokes mount effects', async () => {
    // This is what `requestedRef` is actually for. React 18 runs mount effects twice in
    // StrictMode; without the guard that is two emails against a budget of two an hour,
    // and the second one is spent before the player has read the first.
    render(
      <StrictMode>
        <NonceChallengeModal {...props()} />
      </StrictMode>
    );
    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalled());
    expect(mockReauthenticate).toHaveBeenCalledTimes(1);
  });

  it('sends nothing while closed', () => {
    render(<NonceChallengeModal {...props()} isOpen={false} />);
    expect(mockReauthenticate).not.toHaveBeenCalled();
  });

  it('names the rate limit rather than inviting a retry', async () => {
    // "Please try again" would invite exactly the retry that exhausts the budget.
    mockReauthenticate.mockResolvedValue({
      data: {},
      error: {
        message: 'email rate limit exceeded',
        code: 'over_email_send_rate_limit',
      },
    });
    render(<NonceChallengeModal {...props()} />);

    expect(
      await screen.findByText(
        'Too many emails have been sent recently. Please wait an hour and try again.'
      )
    ).toBeInTheDocument();
  });

  it("surfaces any other send failure in the server's own words", async () => {
    mockReauthenticate.mockResolvedValue({
      data: {},
      error: { message: 'session expired', code: 'session_expired' },
    });
    render(<NonceChallengeModal {...props()} />);
    expect(await screen.findByText('session expired')).toBeInTheDocument();
  });

  it('hands the trimmed code back rather than updating anything itself', async () => {
    const p = props();
    render(<NonceChallengeModal {...p} />);
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    await waitFor(() => expect(confirm).toBeEnabled());

    fireEvent.change(screen.getByLabelText('6-digit code'), {
      target: { value: '  123456  ' },
    });
    fireEvent.click(confirm);

    expect(p.onSubmit).toHaveBeenCalledWith('123456');
  });

  it('will not submit an empty code', async () => {
    const p = props();
    render(<NonceChallengeModal {...p} />);

    // WAIT FOR THE BUTTON, NOT FOR THE CALL. Confirm is `disabled={sending}`, and
    // awaiting `reauthenticate` having been CALLED does not mean its promise has resolved
    // and cleared that flag. Locally it resolves instantly and this passed; in CI under
    // load the click landed on a disabled button, nothing happened, and the assertion
    // below timed out. A race I introduced, caught by CI rather than by me.
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    await waitFor(() => expect(confirm).toBeEnabled());

    fireEvent.click(confirm);

    expect(p.onSubmit).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Enter the code from your email.')
    ).toBeInTheDocument();
  });

  it('resends only when asked', async () => {
    render(<NonceChallengeModal {...props()} />);
    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(2));
  });

  it('forgets the code when closed, so a reopen starts clean', async () => {
    // It holds a one-time secret; leaving it in state across a close is the same
    // mistake AccountDeletionModal avoids with its confirmation text.
    const p = props();
    const { rerender } = render(<NonceChallengeModal {...p} />);
    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('6-digit code'), {
      target: { value: '999999' },
    });
    rerender(<NonceChallengeModal {...p} isOpen={false} />);
    rerender(<NonceChallengeModal {...p} isOpen />);

    await waitFor(() =>
      expect(screen.getByLabelText('6-digit code')).toHaveValue('')
    );
    // And a reopen is a new challenge, so it costs a new code.
    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(2));
  });
});
