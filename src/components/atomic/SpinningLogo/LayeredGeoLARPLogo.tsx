import React from 'react';

/**
 * The geoLARP brand mark: a seven-sided die, drawn in layers.
 *
 * WHY THIS FILE WAS REWRITTEN (#6, #19). It previously drew a gear, a printing
 * mallet and script tags — "Script" and "Hammer" rendered as objects. That was
 * ScriptHammer's mark, inherited by the fork and only *renamed*: its geometry
 * sources in `docs/design/brand-marks/` still carry `<title>ScriptHammer logo</title>`,
 * and `./ringWordmark` baked the string "SCRIPTHAMMER.COM" twice around the gear
 * ring as vector paths — which shipped live on /template, invisible to every
 * text search precisely because it was path data rather than text.
 *
 * Meanwhile `rebrand.sh --icon` had already installed the die as `public/favicon.svg`
 * and all 19 generated icons. So the product had two unrelated marks: a die in
 * every browser tab, and ScriptHammer's lockup in the nav of every page but `/`.
 *
 * THE GEOMETRY IS COPIED FROM `public/favicon.svg`, VERBATIM. Those are the two
 * independent render paths — this component is what the site shows, favicon.svg is
 * what `scripts/generate-icons.js` turns into the icon set — and nothing but a test
 * makes them agree. `scripts/__tests__/manifest-assets.test.js` asserts every path
 * here appears there. If you change one, change both, or that test fails and tells
 * you which.
 */
const INK = '#2E353B';

export interface LayeredGeoLARPLogoProps {
  className?: string;
  /**
   * Supply ONLY when the mark is not already inside a labelled element.
   * Omitted, it renders decorative (`aria-hidden`) — which is what the in-app
   * call sites want, since each wraps it in a labelled link or heading. Adding a
   * second accessible name inside the nav Home link retargets the
   * `mobile-navigation` and `cross-page-navigation` locators (#378).
   */
  ariaLabel?: string;
}

export const LayeredGeoLARPLogo: React.FC<LayeredGeoLARPLogoProps> = ({
  className = 'h-full w-full',
  ariaLabel,
}) => {
  const labelling = ariaLabel
    ? ({ role: 'img', 'aria-label': ariaLabel } as const)
    : ({ 'aria-hidden': true } as const);

  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...labelling}
    >
      {ariaLabel ? <title>{ariaLabel}</title> : null}

      {/* Drop shadow, offset down-right and knocked back. */}
      <g transform="translate(6,8)" opacity="0.45">
        <path
          d="M200,114 L267.2,146.4 L283.8,219.1 L237.3,277.5 L162.7,277.5 L116.2,219.1 L132.8,146.4 Z"
          fill="#12181C"
        />
      </g>

      {/* The seven bevel facets, each a slightly different gold so the solid reads
          as faceted rather than flat. */}
      <g stroke={INK} strokeWidth={3.5} strokeLinejoin="round">
        <path
          d="M200.0,114.0 L267.2,146.4 L234.9,172.1 L200.0,155.3 Z"
          fill="#F0DDB4"
        />
        <path
          d="M267.2,146.4 L283.8,219.1 L243.6,209.9 L234.9,172.1 Z"
          fill="#E6CB99"
        />
        <path
          d="M283.8,219.1 L237.3,277.5 L219.4,240.3 L243.6,209.9 Z"
          fill="#D9BB89"
        />
        <path
          d="M237.3,277.5 L162.7,277.5 L180.6,240.3 L219.4,240.3 Z"
          fill="#EFDBB0"
        />
        <path
          d="M162.7,277.5 L116.2,219.1 L156.4,209.9 L180.6,240.3 Z"
          fill="#DFC392"
        />
        <path
          d="M116.2,219.1 L132.8,146.4 L165.1,172.1 L156.4,209.9 Z"
          fill="#D2B07C"
        />
        <path
          d="M132.8,146.4 L200.0,114.0 L200.0,155.3 L165.1,172.1 Z"
          fill="#E9D0A0"
        />
      </g>

      {/* The face the numeral sits on. */}
      <path
        d="M200.0,155.3 L234.9,172.1 L243.6,209.9 L219.4,240.3 L180.6,240.3 L156.4,209.9 L165.1,172.1 Z"
        fill="#F5E7C6"
        stroke={INK}
        strokeWidth={5}
        strokeLinejoin="round"
      />

      {/* The outer keyline, drawn last so it sits over every facet seam. */}
      <path
        d="M200,114 L267.2,146.4 L283.8,219.1 L237.3,277.5 L162.7,277.5 L116.2,219.1 L132.8,146.4 Z"
        fill="none"
        stroke={INK}
        strokeWidth={8}
        strokeLinejoin="round"
      />

      {/* The 7, baked to a path (#7). It was `<text font-family="Archivo">` until
          the font turned out not to be vendored anywhere, so every icon rendered
          it in a fallback face. */}
      <path d="M184,177 H216 V190 L205,222 H190 L203,190 H184 Z" fill={INK} />
    </svg>
  );
};

LayeredGeoLARPLogo.displayName = 'LayeredGeoLARPLogo';
