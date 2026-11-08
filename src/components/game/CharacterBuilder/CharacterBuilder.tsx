'use client';

import React, { useRef, useState } from 'react';
import {
  ATTRIBUTES,
  AttributeName,
  Character,
  SKILLS,
  SKILL_DICE_BUDGET,
  ATTRIBUTE_DICE_BUDGET,
  SkillName,
  generateCharacter,
} from '@/lib/geolarp/character';
import { formatCode, fromPips, toPips } from '@/lib/geolarp/dice';
import {
  CONCEPT_MAX,
  NAME_MAX,
  formatPips,
  AttributePips,
  SkillPips,
  attributePipsLeft,
  attributeStepRefusal,
  buildCharacter,
  buildRefusal,
  defaultAttributePips,
  skillPipsLeft,
  skillStepRefusal,
  stepAttribute,
  stepSkill,
} from '@/lib/geolarp/creation';

export interface CharacterBuilderProps {
  /** Called with the finished character. The caller stores it. */
  onCreate: (character: Character) => void;
  /** Present when there is somewhere to go back to (the player already has a sheet). */
  onCancel?: () => void;
  className?: string;
}

/**
 * Character creation: a name, five attributes inside the 15D budget, and the
 * twenty skills inside 7D.
 *
 * The defaults are a complete legal character (five 3D attributes, nothing
 * trained), so the fastest path is a name and one tap, and the player only
 * spends time on the choices they care about. Every rule lives in
 * `src/lib/geolarp/creation.ts`; this file only draws it.
 *
 * Nothing typed here leaves the page: it is held in component state until the
 * character is created, and then it is stored in this browser by the caller.
 *
 * @category game
 */
export default function CharacterBuilder({
  onCreate,
  onCancel,
  className = '',
}: CharacterBuilderProps) {
  const [name, setName] = useState('');
  const [concept, setConcept] = useState('');
  const [attrs, setAttrs] = useState<AttributePips>(defaultAttributePips);
  const [skills, setSkills] = useState<SkillPips>({});
  const [hint, setHint] = useState<string | null>(null);
  const [triedEmpty, setTriedEmpty] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const attrLeft = attributePipsLeft(attrs);
  const skillLeft = skillPipsLeft(skills);
  const refusal = buildRefusal(name, attrs, skills);

  const attrStep = (a: AttributeName, d: 1 | -1) => {
    const why = attributeStepRefusal(attrs, a, d);
    setHint(why);
    if (!why) setAttrs(stepAttribute(attrs, a, d));
  };
  const skillStep = (s: SkillName, d: 1 | -1) => {
    const why = skillStepRefusal(skills, s, d);
    setHint(why);
    if (!why) setSkills(stepSkill(skills, s, d));
  };

  const attributeCode = (a: AttributeName) => fromPips(attrs[a]);
  const skillCode = (s: SkillName) =>
    fromPips(toPips(attributeCode(SKILLS[s])) + (skills[s] ?? 0));

  const stepper = (
    label: string,
    code: string,
    onStep: (d: 1 | -1) => void,
    refusalDown: string | null,
    refusalUp: string | null
  ) => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn btn-outline btn-sm min-h-11 min-w-11"
        aria-label={`Lower ${label}`}
        aria-disabled={refusalDown !== null}
        onClick={() => onStep(-1)}
      >
        <span aria-hidden="true">−</span>
      </button>
      <span className="text-base-content w-16 text-center font-mono">
        {code}
      </span>
      <button
        type="button"
        className="btn btn-outline btn-sm min-h-11 min-w-11"
        aria-label={`Raise ${label}`}
        aria-disabled={refusalUp !== null}
        onClick={() => onStep(1)}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );

  return (
    <form
      className={`flex flex-col gap-5${className ? ` ${className}` : ''}`}
      aria-labelledby="builder-heading"
      onSubmit={(e) => {
        e.preventDefault();
        if (refusal) {
          setTriedEmpty(true);
          nameRef.current?.focus();
          return;
        }
        onCreate(buildCharacter(name, attrs, skills, new Date(), concept));
      }}
      noValidate
    >
      <div>
        <h2
          id="builder-heading"
          className="text-base-content text-xl font-bold"
        >
          Make a character
        </h2>
        <p className="text-base-content mt-1 text-sm">
          A name is all you need. The attributes start balanced, so you can play
          now or spend the dice you care about. This character lives in this
          browser only; nothing you type here is sent anywhere.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label
          className="text-base-content flex flex-col gap-1 text-sm"
          htmlFor="builder-name"
        >
          Name
          <input
            id="builder-name"
            ref={nameRef}
            type="text"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wanderer"
            autoComplete="off"
            aria-invalid={triedEmpty && !name.trim()}
            aria-describedby={
              triedEmpty && !name.trim() ? 'builder-name-error' : undefined
            }
            className="input input-bordered min-h-11 w-full"
          />
        </label>
        {triedEmpty && !name.trim() && (
          <p
            id="builder-name-error"
            role="alert"
            className="text-error text-sm"
          >
            Give your character a name.
          </p>
        )}
        <label
          className="text-base-content flex flex-col gap-1 text-sm"
          htmlFor="builder-concept"
        >
          Concept (optional)
          <input
            id="builder-concept"
            type="text"
            value={concept}
            maxLength={CONCEPT_MAX}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="A ferry pilot who owes a favour"
            autoComplete="off"
            className="input input-bordered min-h-11 w-full"
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base-content text-lg font-bold">
          Attributes
        </legend>
        <p
          className="text-base-content text-sm"
          role="status"
          aria-label="Attribute dice left"
        >
          {attrLeft === 0
            ? `All ${ATTRIBUTE_DICE_BUDGET}D spent.`
            : `${formatPips(attrLeft)} of ${ATTRIBUTE_DICE_BUDGET}D left to spend.`}{' '}
          Each attribute runs from 2D to 4D.
        </p>
        <ul className="flex flex-col gap-1">
          {ATTRIBUTES.map((a) => (
            <li key={a} className="flex items-center justify-between gap-2">
              <span className="text-base-content">{a}</span>
              {stepper(
                a,
                formatCode(attributeCode(a)),
                (d) => attrStep(a, d),
                attributeStepRefusal(attrs, a, -1),
                attributeStepRefusal(attrs, a, 1)
              )}
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base-content text-lg font-bold">Skills</legend>
        <p
          className="text-base-content text-sm"
          role="status"
          aria-label="Skill dice left"
        >
          {skillLeft === 0
            ? `All ${SKILL_DICE_BUDGET}D spent.`
            : `${formatPips(skillLeft)} of ${SKILL_DICE_BUDGET}D left to spend.`}{' '}
          Every skill starts at its attribute. Raise a skill up to 1D past it;
          one focus skill may go 2D.
        </p>
        {ATTRIBUTES.map((a) => (
          <div key={a}>
            <h3 className="text-base-content text-sm font-semibold">{a}</h3>
            <ul className="flex flex-col gap-1">
              {(Object.keys(SKILLS) as SkillName[])
                .filter((s) => SKILLS[s] === a)
                .map((s) => (
                  <li
                    key={s}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-base-content">{s}</span>
                    {stepper(
                      s,
                      formatCode(skillCode(s)),
                      (d) => skillStep(s, d),
                      skillStepRefusal(skills, s, -1),
                      skillStepRefusal(skills, s, 1)
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </fieldset>

      <p
        className="text-base-content min-h-6 text-sm"
        role="status"
        aria-live="polite"
        data-testid="builder-hint"
      >
        {hint ?? ''}
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary min-h-11 flex-1">
          Create character
        </button>
        <button
          type="button"
          className="btn btn-outline min-h-11 flex-1"
          onClick={() => onCreate(generateCharacter(name.trim() || 'Wanderer'))}
        >
          Roll one for me
        </button>
        {onCancel && (
          <button
            type="button"
            className="btn btn-ghost min-h-11"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
