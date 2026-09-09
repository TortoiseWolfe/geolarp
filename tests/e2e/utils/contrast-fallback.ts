/**
 * Measure the contrast axe refuses to (#459).
 *
 * THE DEFECT THIS EXISTS FOR. axe returns a **pass** for any element whose ratio
 * it could not compute, with `contrastRatio: null` and the message "Element has
 * sufficient color contrast of null". Those land in `passes`, so a gate that
 * asserts only on `violations` counts "could not measure" as "verified" — the
 * one direction a probe must never round. Measured before this existed: 193 such
 * nodes across six routes, one in five of everything reported as passing.
 *
 * WHY ONE TECHNIQUE COVERS ALL OF THEM. Every single unmeasured node was text on
 * a **gradient**. axe gives up because the background varies across the element.
 * It does not vary unpredictably, though: a gradient interpolates between
 * ADJACENT stops, so luminance along the ramp always lies between the two stops
 * bounding it. Checking every declared stop therefore covers the extremes, and
 * no rasterising is needed.
 *
 * WHY CANVAS READBACK. `getComputedStyle` hands back `oklch()` / `oklab()`
 * verbatim — this codebase is entirely oklch — so parsing a colour as RGB yields
 * nonsense. Assigning it to `ctx.fillStyle` and reading one pixel back is the
 * only thing that resolves whatever the browser understands, including the
 * `color-mix()` the browser has already flattened into `oklab()`.
 *
 * WHAT IT FOUND. Three real AAA failures hiding behind a null-ratio pass,
 * including the /pricing "Select" buy button at 4.21:1 (#778).
 *
 * @module tests/e2e/utils/contrast-fallback
 */

/** Why a node could not be measured even by this fallback. */
export type UnresolvableReason =
  /** A `url()` layer — an image cannot be reduced to a colour. */
  | 'background-image-url'
  /** A background stack that resolved to no colour at all. */
  | 'no-background'
  /** `background-clip: text` with no gradient to take the text colour from. */
  | 'no-foreground';

export interface FallbackRow {
  selector: string;
  /** Stable-ish identity for allowlisting: tag + first classes. Never a positional selector. */
  signature: string;
  text: string;
  kind: 'measured' | 'not-visible' | 'unresolvable';
  reason?: UnresolvableReason;
  /** Worst ratio across every gradient stop. Present when kind === 'measured'. */
  ratio?: number;
  /** 7, or 4.5 for WCAG "large" text. */
  required?: number;
  mode?: 'own-gradient' | 'ancestor-gradient' | 'bg-clip-text';
  fg?: string;
  bg?: string;
  /** For `background-image-url`: the base colour under the image, for triage only. */
  baseColorRatio?: number;
  /**
   * For `background-image-url`: the signature of the element CARRYING the image.
   *
   * Often not the element with the text. DaisyUI's noise texture sits on the
   * `.badge`, and what fails to measure is the `<span>` inside it — whose own
   * signature is something like `span.text-xs`, far too generic to allowlist
   * without exempting every small span in the product. Allowlisting the blocker
   * keeps the exemption as narrow as the actual cause.
   */
  blockedBy?: string;
}

/**
 * Runs IN THE PAGE. Pass it straight to `page.evaluate(measureNullRatioNodes, targets)`.
 *
 * Self-contained by necessity — Playwright serialises this function, so it cannot
 * close over anything in module scope. Deliberately not `eval`'d.
 */
export function measureNullRatioNodes(targets: string[]): FallbackRow[] {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D;

  /**
   * Any CSS colour → rgb, via the browser. The only thing that handles oklch().
   *
   * TWO SENTINELS, BECAUSE ONE CANNOT TELL "REJECTED" FROM "PARSED TO THE SENTINEL".
   *
   * An invalid assignment to `fillStyle` is silently ignored, leaving the previous
   * value in place — so a single seed detects failure only by the value not moving,
   * which is indistinguishable from a colour that legitimately equals the seed.
   * This seeded with `#000000` and carved out an exception for `#000`/`black` by
   * regex. It missed `rgb(0, 0, 0)`, which is the ONLY form `getComputedStyle` ever
   * returns — so every element with pure black text was reported `no-foreground`
   * and dropped from the measurement as unresolvable. Found on /map, where Leaflet's
   * zoom controls are black on white: 21:1, the highest ratio obtainable, filed as
   * unmeasurable (#43).
   *
   * Seeding twice removes the guesswork rather than lengthening the exception list.
   * If both assignments land on the same value, the browser parsed the input — it
   * cannot agree by accident, because the seeds disagree. If they differ, both were
   * rejected and each still holds its own seed. No colour needs naming.
   */
  const rgbOf = (css: string): [number, number, number] | null => {
    if (!css) return null;
    ctx.fillStyle = '#000000';
    ctx.fillStyle = css;
    const asBlackSeed = ctx.fillStyle;
    ctx.fillStyle = '#ffffff';
    ctx.fillStyle = css;
    if (ctx.fillStyle !== asBlackSeed) return null; // rejected twice — unparseable
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };

  const luminance = ([r, g, b]: [number, number, number]): number => {
    const f = (c: number) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const ratioOf = (
    a: [number, number, number],
    b: [number, number, number]
  ): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((m, n) => n - m);
    return (hi + 0.05) / (lo + 0.05);
  };

  /**
   * Split a background-image value into its TOP-LEVEL comma-separated layers.
   *
   * Paren-depth counting, not a regex. The regex version — `/,(?![^()]*\))/` —
   * also split inside `rgba(0, 0, 0, 0)`, shredding one chevron gradient into
   * fragments. The transparent stop landed in one fragment and the opaque arrow
   * colour in another, so the arrow fragment looked like a legitimate surface
   * and was measured as the text's background: fg and bg both resolved to
   * `--color-base-content` and scored a perfect 1:1 on selects that are
   * perfectly legible. A splitter that cannot see its own nesting produces
   * confident nonsense.
   */
  const layersOf = (v: string): string[] => {
    const out: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < (v || '').length; i++) {
      const ch = v[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) {
        out.push(v.slice(start, i).trim());
        start = i + 1;
      }
    }
    if (v) out.push(v.slice(start).trim());
    return out.filter(Boolean);
  };

  /**
   * A layer list of nothing but `none` is NOT a background image.
   *
   * `backgroundImage` on a multi-layer element reads `"none, none"`, which is
   * not equal to `'none'`. Treating that as a gradient sent 30 nodes down the
   * stop-parsing path, found no colours, and reported them unresolvable — a
   * self-inflicted blind spot inside the fix for a blind spot.
   */
  const hasBgImage = (v: string): boolean =>
    !!v && v !== 'none' && layersOf(v).some((layer) => layer !== 'none');

  const hasUrlLayer = (v: string): boolean => /(^|[\s,])url\(/.test(v || '');

  /** Every colour token in a computed gradient. color-mix() is already flattened by here. */
  const gradientStops = (v: string): string[] => {
    const out: string[] = [];
    const re =
      /(oklch|oklab|rgba?|hsla?|lab|lch|color)\([^()]*(?:\([^()]*\)[^()]*)*\)|#[0-9a-fA-F]{3,8}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(v))) out.push(m[0]);
    return out;
  };

  /**
   * A LAYER WITH A TRANSPARENT STOP IS A SHAPE, NOT A SURFACE.
   *
   * DaisyUI draws the `<select>` dropdown chevron as two hard-stop gradients:
   *
   *   linear-gradient(45deg,  rgba(0,0,0,0) 50%, oklch(0.9288 …) 0px),
   *   linear-gradient(135deg, oklch(0.9288 …) 50%, rgba(0,0,0,0) …)
   *
   * That arrow is the SAME colour as the label text, so worst-of-stops scored a
   * perfect 1:1 and reported "invisible text" on four selects that are perfectly
   * legible — verified by screenshot. The chevron is a glyph in the corner; the
   * text sits on the element's opaque background-color.
   *
   * A gradient that genuinely forms the surface behind text (the pricing CTA, the
   * hero wash) interpolates between OPAQUE stops and covers the box. One carrying
   * a transparent stop only partially covers it, so it cannot be assumed to be
   * what the text sits on. Those layers are dropped; the surface underneath is
   * used instead.
   */
  const isSurfaceLayer = (layer: string): boolean =>
    layer !== 'none' &&
    !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|(^|[\s,(])transparent([\s,)]|$)/.test(
      layer
    );

  /** Stops from only those layers that actually form a surface. */
  const surfaceStops = (v: string): string[] =>
    layersOf(v)
      .filter(isSurfaceLayer)
      .flatMap((layer) => gradientStops(layer));

  /**
   * Nearest ancestor background that resolves to actual colours.
   *
   * `urlBlocked` IS NOT THE SAME AS FINDING NOTHING, and conflating the two is
   * the bug this shape exists to prevent (#105). An empty result used to mean
   * both "walked to the body and found no colour" and "an image is in the way",
   * and the caller treated the second as the first — so text over a background
   * image was measured against whatever sits BEHIND the image.
   *
   * A `url()` layer paints over the element's own background-color and over
   * everything it inherits. Once the walk meets one it must stop and say so:
   * every colour further down the stack is a colour that image is hiding.
   */
  const ancestorBg = (
    el: Element
  ): {
    stops: [number, number, number][];
    urlBlocked: boolean;
    blocker: Element | null;
  } => {
    let p = el.parentElement;
    let depth = 0;
    while (p && depth < 20) {
      const cs = getComputedStyle(p);
      if (hasBgImage(cs.backgroundImage)) {
        const s = surfaceStops(cs.backgroundImage)
          .map(rgbOf)
          .filter(Boolean) as [number, number, number][];
        if (s.length) return { stops: s, urlBlocked: false, blocker: null };
        // No stops AND a url() layer: an image with no readable colour, sitting
        // on top of everything below. Climbing past it is how a hero photo's
        // caption got measured against the section colour behind the photo.
        if (hasUrlLayer(cs.backgroundImage))
          return { stops: [], urlBlocked: true, blocker: p };
      }
      if (!/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) {
        const c = rgbOf(cs.backgroundColor);
        if (c) return { stops: [c], urlBlocked: false, blocker: null };
      }
      p = p.parentElement;
      depth++;
    }
    const body = rgbOf(getComputedStyle(document.body).backgroundColor);
    return { stops: body ? [body] : [], urlBlocked: false, blocker: null };
  };

  const rows: FallbackRow[] = [];

  for (const selector of targets) {
    let el: Element | null = null;
    try {
      el = document.querySelector(selector);
    } catch {
      /* an axe selector we cannot re-resolve */
    }
    const signatureOf = (e: Element | null) =>
      e
        ? `${e.tagName.toLowerCase()}.${(e.className || '')
            .toString()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 3)
            .join('.')}`
        : selector;

    if (!el) {
      rows.push({
        selector,
        signature: selector,
        text: '',
        kind: 'unresolvable',
        reason: 'no-background',
      });
      continue;
    }

    const cs = getComputedStyle(el);
    const signature = signatureOf(el);
    const text = (el.textContent || '').trim().slice(0, 40);

    // An invisible element has no contrast to get wrong.
    //
    // NOT CURRENTLY LOAD-BEARING, AND SAID SO HONESTLY. This was added after the
    // colourblind <select> on /accessibility/ measured a perfect 1:1 — foreground
    // identical to background, catastrophic-looking, and Playwright could not even
    // scroll to it. The REAL cause turned out to be elsewhere: that 1:1 came from
    // reading a decorative chevron gradient as the text's background, which
    // isSurfaceLayer now filters. Deleting this guard entirely changes no result
    // today — verified by mutation, 7 passed either way.
    //
    // Kept because the principle holds regardless of whether a case currently
    // exercises it, and because measuring a hidden element can only ever produce a
    // number nobody can act on. But it is documented as unproven rather than
    // credited with a fix it did not make.
    if (
      el.getClientRects().length === 0 ||
      cs.visibility === 'hidden' ||
      cs.display === 'none' ||
      Number(cs.opacity) === 0
    ) {
      rows.push({ selector, signature, text, kind: 'not-visible' });
      continue;
    }

    const clipsToText =
      cs.webkitBackgroundClip === 'text' ||
      (cs as unknown as { backgroundClip?: string }).backgroundClip === 'text';
    const fillTransparent = /rgba\(0, 0, 0, 0\)|transparent/.test(
      cs.webkitTextFillColor || ''
    );

    let fgs: [number, number, number][];
    let bgs: [number, number, number][];
    let mode: FallbackRow['mode'];
    /**
     * An image is in the way, so no colour under it is the measurement (#105).
     *
     * Tracked separately from `bgs.length` because the two used to be the same
     * test, and a `url()` background always found SOMETHING to fall back to —
     * its own background-color, or an ancestor's. So the unresolvable branch
     * below, whose comment has always described exactly this case, was
     * unreachable on the one path that needed it.
     */
    let urlBlocked = false;
    /** The element carrying the blocking image — often an ancestor, not `el`. */
    let blocker: Element | null = null;

    if (clipsToText && fillTransparent) {
      // INVERTED: the gradient IS the text. Stops are the foreground; the
      // background is whatever the element sits on.
      mode = 'bg-clip-text';
      fgs = surfaceStops(cs.backgroundImage).map(rgbOf).filter(Boolean) as [
        number,
        number,
        number,
      ][];
      const a = ancestorBg(el);
      bgs = a.stops;
      urlBlocked = a.urlBlocked;
      blocker = a.blocker;
    } else if (hasBgImage(cs.backgroundImage)) {
      mode = 'own-gradient';
      const fg = rgbOf(cs.color);
      fgs = fg ? [fg] : [];
      bgs = surfaceStops(cs.backgroundImage).map(rgbOf).filter(Boolean) as [
        number,
        number,
        number,
      ][];
      if (!bgs.length) {
        // NO STOPS SPLITS TWO WAYS, and telling them apart is the whole fix.
        //
        // Every layer was decoration — a chevron, an underline — and the real
        // surface is the element's own background-color. That is the recovery
        // this branch was written for, and it is still right.
        //
        // OR one of those layers is a `url()`, which is not decoration we can
        // see through: it is an opaque unknown painted over that same
        // background-color. DaisyUI's `.btn` is exactly this — `none,
        // url(data:…feTurbulence…)` over `--btn-bg` — and it was being scored
        // against `--btn-bg` on every route, with the texture unaccounted for.
        if (hasUrlLayer(cs.backgroundImage)) {
          urlBlocked = true;
          blocker = el;
        } else {
          const own = /rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)
            ? null
            : rgbOf(cs.backgroundColor);
          if (own) {
            bgs = [own];
          } else {
            const a = ancestorBg(el);
            bgs = a.stops;
            urlBlocked = a.urlBlocked;
            blocker = a.blocker;
          }
        }
      }
    } else {
      mode = 'ancestor-gradient';
      const fg = rgbOf(cs.color);
      fgs = fg ? [fg] : [];
      const a = ancestorBg(el);
      bgs = a.stops;
      urlBlocked = a.urlBlocked;
      blocker = a.blocker;
    }

    if (urlBlocked || !fgs.length || !bgs.length) {
      // A url() layer is the one background this technique genuinely cannot
      // reduce to a colour. Report the base background-color underneath it for
      // triage — but do NOT treat that as the measurement, because the image
      // sits on top of it and is unaccounted for. Rounding it to a pass would
      // be #459 with extra steps.
      const reason: UnresolvableReason = urlBlocked
        ? 'background-image-url'
        : !fgs.length
          ? 'no-foreground'
          : 'no-background';
      let baseColorRatio: number | undefined;
      const fg = rgbOf(cs.color);
      // Only the element's OWN opaque colour is worth reporting for triage. A
      // transparent one parses to black through the canvas and would print a
      // confident 21:1 that means nothing — a triage number that misleads is
      // worse than an absent one, which is this file's whole thesis.
      const base = /rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)
        ? null
        : rgbOf(cs.backgroundColor);
      if (fg && base)
        baseColorRatio = Math.round(ratioOf(fg, base) * 100) / 100;
      rows.push({
        selector,
        signature,
        text,
        kind: 'unresolvable',
        reason,
        mode,
        baseColorRatio,
        ...(urlBlocked ? { blockedBy: signatureOf(blocker ?? el) } : {}),
      });
      continue;
    }

    let worst = Infinity;
    let worstFg = fgs[0];
    let worstBg = bgs[0];
    for (const f of fgs) {
      for (const b of bgs) {
        const r = ratioOf(f, b);
        if (r < worst) {
          worst = r;
          worstFg = f;
          worstBg = b;
        }
      }
    }

    // WCAG "large text": >= 24px, or >= 18.66px when bold. Everything else needs
    // the full AAA 7:1.
    const px = parseFloat(cs.fontSize) || 16;
    const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);

    rows.push({
      selector,
      signature,
      text,
      kind: 'measured',
      mode,
      ratio: Math.round(worst * 100) / 100,
      required: large ? 4.5 : 7,
      fg: `rgb(${worstFg.join(',')})`,
      bg: `rgb(${worstBg.join(',')})`,
    });
  }

  return rows;
}

/**
 * Vendor-owned elements whose contrast we neither set nor can change.
 *
 * The route-level `EXCLUDED` map in color-contrast.spec.ts already takes this
 * position for `/chatt` ("Cesium error panel is vendor markup"). Leaflet's
 * attribution control is the same category — third-party chrome, rendered by the
 * map library, styled by it. Excluding the ELEMENT keeps the rest of /map
 * measured, which excluding the route would throw away.
 *
 * This is not a threshold and not a filter on our own UI: adding anything here
 * means asserting we do not own that element's colours.
 */
export const VENDOR_EXCLUDED: ReadonlyArray<{
  selectorFragment: string;
  why: string;
}> = [
  {
    // 'leaflet' not 'leaflet-control-attribution': the failing nodes are the
    // links INSIDE it, and axe addresses one of them as `a[href$="leafletjs.com"]`
    // — which never contains the container's class name.
    selectorFragment: 'leaflet',
    why:
      "Leaflet's own attribution control. Measured 4.94:1 on its 'Leaflet' and " +
      "'OpenStreetMap' links, which Leaflet styles itself — we neither set those " +
      'colours nor can change them without patching vendor CSS. Same call the ' +
      "spec's EXCLUDED map already makes for Cesium's error panel, but scoped to " +
      'the element so the rest of /map stays measured.',
  },
];

/**
 * Signatures allowed to remain unmeasurable, each with the reason.
 *
 * ASSERTED AS A SET, NOT A COUNT. A count lets one unresolvable node appear as
 * another is fixed and stay green throughout. Matching the set means a NEW
 * unmeasurable element fails even while the total holds steady.
 */
export const UNRESOLVABLE_ALLOWLIST: ReadonlyArray<{
  /** Matches the element with the text. Omit when only the blocker identifies it. */
  signature?: RegExp;
  /**
   * Matches the element CARRYING the background image (`FallbackRow.blockedBy`).
   *
   * This is the narrow way to exempt a whole component. DaisyUI's noise texture
   * sits on the `.badge`, and what cannot be measured is the `<span>` inside it —
   * signature `span.text-xs`. Allowlisting THAT would exempt every small span in
   * the product, which is the gate quietly shrinking, the exact failure this file
   * exists to prevent. Allowlisting the blocker exempts only what the texture
   * actually covers.
   */
  blockedBy?: RegExp;
  reason: UnresolvableReason;
  why: string;
}> = [
  {
    // The element IS the .btn/.badge, or sits inside one. Both come back with
    // `blockedBy` naming the component that carries the texture.
    //
    // THIS ENTRY USED TO BE DEAD (#105). It read `signature: /^[a-z]+\.btn(\.|$)/`
    // and described exactly the behaviour below — and could never match, because
    // a `url()` layer yielded no stops, which sent the row down the "every layer
    // was decoration" recovery, which always found the opaque `--btn-bg`
    // underneath. Every button on every route was being MEASURED against the
    // colour beneath its texture, while this entry sat here asserting otherwise.
    // Verified by fixture before and after: 12.55:1 `measured` -> `unresolvable`.
    // DERIVED FROM DAISYUI'S SOURCE, not from whichever failures happened to
    // appear first. `grep -l noise node_modules/daisyui/components/*.css` names
    // eight files; these are the ones that can block TEXT:
    //
    //   .alert .badge .btn .checkbox .file-input .radio   — on the element itself
    //   .menu-active                                       — menu paints it only
    //                                                        on the active item
    //   (.toggle is excluded: its noise is on `::before`, which
    //    getComputedStyle(el) never reports, so it can block nothing)
    //
    // NOT anchored at the start. `class="foo btn"` gives the signature
    // `a.foo.btn`, and the previous `/^[a-z]+\.btn/` would have missed it — the
    // old entry's own comment records `a.btn.btn-primary` catching it out once.
    // `(\.|$)` after each name keeps `badge` from matching `badge-xs`.
    blockedBy:
      /(^|\.)(alert|badge|btn|checkbox|file-input|radio|menu-active)(\.|$)/,
    reason: 'background-image-url',
    why:
      'DaisyUI layers an SVG noise texture (`--fx-noise`, a fractalNoise ' +
      'feTurbulence at opacity 0.2) over .alert, .badge, .btn and four other ' +
      'components, so the computed ' +
      'background is `none, url(data:image/svg+xml,...)`. An image cannot be ' +
      'reduced to a colour by stop inspection, and it covers the element AND ' +
      'everything inside it — so the text within a badge is unmeasurable too. ' +
      'The base background-color IS reported alongside for triage, but is ' +
      'deliberately not accepted as the measurement: the texture sits on top of ' +
      'it and is unaccounted for. Resolving this properly needs pixel readback ' +
      'of the rendered element (#459), which is now the only route to restoring ' +
      'AAA coverage on every button and badge in the product.',
  },
];
