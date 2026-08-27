import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import CharacterSigil from './CharacterSigil';
import { generateCharacter } from '@/lib/geolarp/character';

expect.extend(toHaveNoViolations);

const character = generateCharacter('Ada Wren');

describe('CharacterSigil accessibility', () => {
  it('has no violations when decorative', async () => {
    const { container } = render(
      <CharacterSigil character={character} decorative />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations when named', async () => {
    const { container } = render(
      <CharacterSigil character={character} label="Ada Wren's sigil" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
