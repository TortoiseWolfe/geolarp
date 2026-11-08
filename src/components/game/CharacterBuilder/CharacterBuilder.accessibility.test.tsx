import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import CharacterBuilder from './CharacterBuilder';

expect.extend(toHaveNoViolations);

describe('CharacterBuilder accessibility', () => {
  it('has no violations', async () => {
    const { container } = render(
      <CharacterBuilder onCreate={vi.fn()} onCancel={vi.fn()} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
