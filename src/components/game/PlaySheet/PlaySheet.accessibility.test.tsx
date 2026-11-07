import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import PlaySheet from './PlaySheet';

expect.extend(toHaveNoViolations);

describe('PlaySheet accessibility', () => {
  beforeEach(() => window.localStorage.clear());

  it('has no violations on first visit', async () => {
    const { container } = render(
      <PlaySheet today={new Date('2026-11-04T12:00:00Z')} />
    );
    await screen.findByRole('heading', { name: 'Make a character' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with a character and a roll open', async () => {
    const { container } = render(
      <PlaySheet today={new Date('2026-11-04T12:00:00Z')} />
    );
    await userEvent.type(await screen.findByLabelText('Name'), 'Ada Wren');
    await userEvent.click(
      screen.getByRole('button', { name: 'Create character' })
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /^Search/ })
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
