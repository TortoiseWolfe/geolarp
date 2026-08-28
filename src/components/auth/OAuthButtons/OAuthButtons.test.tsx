import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import OAuthButtons from './OAuthButtons';

/**
 * A provider button only exists when that provider can complete a sign-in (#9).
 *
 * The live project had `external_github_enabled: false` and
 * `external_google_enabled: false` while both buttons shipped, so every press
 * failed at the provider. These tests previously rendered the component bare
 * and asserted the GitHub button existed — which is why nothing caught it: the
 * assertion was about the markup, never about whether the button could work.
 */
afterEach(() => vi.unstubAllEnvs());

function enable(github: boolean, google: boolean) {
  vi.stubEnv('NEXT_PUBLIC_AUTH_GITHUB_ENABLED', github ? 'true' : '');
  vi.stubEnv('NEXT_PUBLIC_AUTH_GOOGLE_ENABLED', google ? 'true' : '');
}

describe('OAuthButtons', () => {
  it('renders a provider that is enabled', () => {
    enable(true, true);
    render(<OAuthButtons />);
    expect(screen.getByRole('button', { name: /github/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    enable(true, true);
    const customClass = 'custom-class';
    const { container } = render(<OAuthButtons className={customClass} />);
    const element = container.firstChild as HTMLElement;
    expect(element).toHaveClass(customClass);
  });

  it('RENDERS NOTHING when no provider is configured', () => {
    // The state this project is actually in. A button that always fails reads
    // as a broken product rather than a feature not offered.
    enable(false, false);
    const { container } = render(<OAuthButtons />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('is OFF by default, so an unconfigured fork ships no dead buttons', () => {
    // Deliberately does not stub anything: the default must be off, the same
    // deny-by-default reasoning as the column grants in #38.
    vi.unstubAllEnvs();
    const { container } = render(<OAuthButtons />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows only the provider that is enabled', () => {
    enable(true, false);
    render(<OAuthButtons />);
    expect(screen.getByRole('button', { name: /github/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /google/i })
    ).not.toBeInTheDocument();
  });

  it('treats any value other than true/1 as off', () => {
    // A half-configured fork setting FALSE, "no" or an empty string must not
    // get a button that cannot work.
    for (const value of ['false', 'no', '0', '', 'TRUE ']) {
      vi.stubEnv('NEXT_PUBLIC_AUTH_GITHUB_ENABLED', value);
      vi.stubEnv('NEXT_PUBLIC_AUTH_GOOGLE_ENABLED', value);
      const { container, unmount } = render(<OAuthButtons />);
      expect(container, `value ${JSON.stringify(value)}`).toBeEmptyDOMElement();
      unmount();
    }
  });
});
