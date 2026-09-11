import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe } from 'jest-axe';
import NonceChallengeModal from './NonceChallengeModal';

const { mockReauthenticate } = vi.hoisted(() => ({
  mockReauthenticate: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { reauthenticate: mockReauthenticate } },
}));

describe('NonceChallengeModal accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReauthenticate.mockResolvedValue({ data: {}, error: null });
  });

  const props = {
    isOpen: true,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
  };

  it('has no axe violations when open', async () => {
    const { container } = render(<NonceChallengeModal {...props} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('labels the code input and names the dialog', () => {
    const { container } = render(<NonceChallengeModal {...props} />);

    // A code field with no label is unusable by screen reader, and `axe`'s label rule is
    // the only thing standing between that and shipping.
    const input = container.querySelector('#nonce-input');
    expect(input).toBeInTheDocument();
    expect(
      container.querySelector('label[for="nonce-input"]')
    ).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-required', 'true');

    const dialog = container.querySelector('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'nonce-challenge-title');
    expect(dialog).toHaveAttribute(
      'aria-describedby',
      'nonce-challenge-description'
    );
    expect(
      container.querySelector('#nonce-challenge-title')
    ).toBeInTheDocument();
    expect(
      container.querySelector('#nonce-challenge-description')
    ).toBeInTheDocument();
  });

  it('announces the sent-code status politely', () => {
    const { container } = render(<NonceChallengeModal {...props} />);
    const status = container.querySelector('[role="status"]');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('gives every action a 44px touch target', () => {
    const { container } = render(<NonceChallengeModal {...props} />);
    const buttons = container.querySelectorAll('.modal-action button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    buttons.forEach((b) => {
      expect(b.className).toMatch(/min-h-11/);
      expect(b.className).toMatch(/min-w-11/);
    });
  });
});
