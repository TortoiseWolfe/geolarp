import Link from 'next/link';
import CharacterSheet from '@/components/game/CharacterSheet';
import { generateCharacter } from '@/lib/geolarp/character';
import { Rng } from '@/lib/geolarp/rng';

/**
 * geoLARP.com home.
 *
 * Grown out of the Coming Soon page (same file, same steampunk frame: the
 * brass bezel, the counter-rotating globe, the seven-sided die). The notify-me
 * form and its Supabase call are gone on purpose: the MVP is local-only, so the
 * home page collects nothing and offers two honest doors instead, the post that
 * explains the game and the character sheet you can use today.
 *
 * The sample sheet is the REAL `CharacterSheet`, read-only, on a fixed
 * character, so what a visitor sees here is what /play gives them.
 *
 * HEADLINES: no single word alone on a line. `text-wrap: balance` spreads the
 * words, and the last two words of every headline are joined by a no-break
 * space so a lone final word cannot be left on its own line at any width.
 * `tests/e2e/tests/headline-wrap.spec.ts` measures the rendered lines.
 */

/** Brass. The canvas exposed this as a colour prop; there is one brand value. */
const ACCENT = '#E8B84B';

/** Seconds for one bezel revolution. Canvas default; 6-90 was the design range. */
const SPIN_SECONDS = 28;

/** A fixed sample, so the page is the same for everyone and for every build. */
const SAMPLE = {
  ...generateCharacter('Ada Wren', new Rng('home-sample')),
  concept: 'A cartographer who walks the edges of the map',
  created: '2026-11-04T00:00:00.000Z',
};

export default function Home() {
  return (
    <main
      data-theme="geolarp-dark"
      className="gl-root"
      style={
        {
          '--geo-accent': ACCENT,
          '--geo-spin': `${SPIN_SECONDS}s`,
        } as React.CSSProperties
      }
    >
      <style>{`
        .gl-root {
          min-height: 100vh;
          padding: 56px 32px 72px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 36px;
          position: relative;
          overflow: hidden;
          background: #0C0805;
          color: #EFE2C6;
          font-family: Archivo, ui-sans-serif, system-ui, sans-serif;
        }
        @keyframes gl-spin { to { transform: rotate(360deg); } }
        @keyframes gl-spin-rev { to { transform: rotate(-360deg); } }
        @keyframes gl-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        @keyframes gl-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gl-glow { 0%, 100% { opacity: 0.22; } 50% { opacity: 0.5; } }

        .gl-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .gl-bg-wash { position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 34%, #2A2015 0%, #171009 46%, #0C0805 100%); }
        .gl-bg-hatch { position: absolute; inset: 0; opacity: 0.35;
          background: repeating-linear-gradient(58deg, rgba(232,184,75,0.05) 0px, rgba(232,184,75,0.05) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 9px); }

        .gl-spin { animation: gl-spin var(--geo-spin) linear infinite; transform-origin: 200px 200px; transform-box: view-box; }
        .gl-spin-rev { animation: gl-spin-rev 52s linear infinite; transform-origin: 200px 200px; transform-box: view-box; }

        .gl-wordmark { display: flex; align-items: baseline;
          font-family: Spectral, Georgia, serif; font-weight: 800; font-size: 62px;
          letter-spacing: -1px; text-shadow: 0 2px 0 #00000066;
          animation: gl-rise 0.9s 0.2s ease-out both; }
        .gl-wordmark span:last-child { color: var(--geo-accent); }

        .gl-content { position: relative; width: min(760px, 100%); display: flex; flex-direction: column; gap: 56px; }
        .gl-hero { padding-top: 12px; }
        .gl-h1 { font-family: Spectral, Georgia, serif; font-weight: 800;
          font-size: clamp(30px, 6.4vw, 46px); line-height: 1.12; letter-spacing: -0.5px;
          text-wrap: balance; text-shadow: 0 2px 0 #00000066; margin: 0; }
        .gl-h1 em { font-style: normal; color: var(--geo-accent); }
        .gl-h2 { font-family: Cinzel, Georgia, serif; font-weight: 700;
          font-size: clamp(20px, 4.6vw, 26px); line-height: 1.2; letter-spacing: 1px;
          color: var(--geo-accent); text-wrap: balance; margin: 0 0 14px; }
        .gl-lede { font-family: Spectral, Georgia, serif; font-size: 19px; line-height: 1.55;
          margin: 0; max-width: 60ch; }
        .gl-doors { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 4px; }
        .gl-door { display: inline-flex; align-items: center; justify-content: center;
          min-height: 52px; padding: 0 26px; text-decoration: none; text-align: center;
          font-family: Cinzel, Georgia, serif; font-weight: 700; font-size: 14px;
          letter-spacing: 2.5px; text-transform: uppercase; border-radius: 3px; }
        .gl-door-main { color: #0C0805; background: linear-gradient(#F0D69A, #C79B36);
          border: 2px solid #7A5C20; box-shadow: inset 0 1px 0 #FFF4D8, 0 2px 0 #5C4419; }
        .gl-door-main:hover { background: linear-gradient(#F7E3B4, #D3A840); }
        .gl-door-alt { color: #EFE2C6; background: #0E0905; border: 2px solid #8A6A26; }
        .gl-door-alt:hover { border-color: #E3C688; }
        .gl-door:focus-visible { outline: 3px solid #EFE2C6; outline-offset: 3px; }
        .gl-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
          list-style: none; padding: 0; margin: 0; }
        .gl-step { padding: 18px 18px 20px; border: 1px solid #8A6A2699; border-radius: 4px;
          background: #1C140Cd9; }
        .gl-step b { display: block; font-family: Cinzel, Georgia, serif; font-size: 15px;
          letter-spacing: 1px; color: var(--geo-accent); margin-bottom: 6px; }
        .gl-step span { font-family: Spectral, Georgia, serif; font-size: 16px; line-height: 1.5; }
        .gl-note { font-family: Spectral, Georgia, serif; font-size: 16px; line-height: 1.55;
          margin: 0 0 18px; max-width: 62ch; }
        .gl-foot { font-family: Spectral, Georgia, serif; font-size: 15px; line-height: 1.6;
          padding-top: 24px; border-top: 1px solid #8A6A2666; }
        .gl-foot a { color: #E3C688; text-decoration: underline; text-underline-offset: 3px; }
        .gl-mark-small { width: 108px; height: 108px; flex: none; }
        .gl-top { display: flex; align-items: center; gap: 18px; margin-bottom: 26px; }
        .gl-top .gl-wordmark { font-size: 40px; animation: none; }

        /* The rings carry meaning, not decoration, but motion sensitivity wins. */
        @media (prefers-reduced-motion: reduce) {
          .gl-spin, .gl-spin-rev, .gl-wordmark { animation: none; }
        }
        @media (max-width: 640px) {
          .gl-root { padding: 36px 16px 48px; }
          .gl-steps { grid-template-columns: 1fr; }
          .gl-door { width: 100%; }
          .gl-top .gl-wordmark { font-size: 32px; }
          .gl-mark-small { width: 84px; height: 84px; }
        }
      `}</style>

      {/* Shared geometry. Defined once, referenced by <use>. */}
      <svg
        width="0"
        height="0"
        style={{ position: 'absolute', opacity: 0 }}
        aria-hidden="true"
      >
        <defs>
          <path
            id="gl-arc-top"
            d="M40,200 A160,160 0 0 1 360,200"
            fill="none"
          />
          <path
            id="gl-arc-bottom"
            d="M360,200 A160,160 0 0 1 40,200"
            fill="none"
          />

          <g id="gl-bezel">
            <circle
              cx="200"
              cy="200"
              r="170"
              fill="none"
              stroke="#090603"
              strokeWidth="48"
              transform="translate(5,7)"
              opacity="0.5"
            />
            <circle
              cx="200"
              cy="200"
              r="170"
              fill="none"
              stroke="#2A1C0E"
              strokeWidth="48"
            />
            <circle
              cx="200"
              cy="200"
              r="192"
              fill="none"
              stroke="#E3C688"
              strokeWidth="5"
            />
            <circle
              cx="200"
              cy="200"
              r="148"
              fill="none"
              stroke="#E3C688"
              strokeWidth="5"
            />
            <circle
              cx="200"
              cy="200"
              r="153"
              fill="none"
              stroke="#B08A3C"
              strokeWidth="7"
              strokeDasharray="3 17"
            />
            <path d="M200,0 L211,22 L189,22 Z" fill="var(--geo-accent)" />
            <g fill="#B08A3C">
              <path d="M373,190 L383,200 L373,210 L363,200 Z" />
              <path d="M27,190 L37,200 L27,210 L17,200 Z" />
            </g>
            <text
              fontFamily="Archivo, sans-serif"
              fontWeight="800"
              fontSize="41"
              letterSpacing="1.5"
              fill="#E3C688"
            >
              <textPath
                href="#gl-arc-top"
                startOffset="50%"
                textAnchor="middle"
              >
                geoLARP.com
              </textPath>
            </text>
            <text
              fontFamily="Archivo, sans-serif"
              fontWeight="800"
              fontSize="41"
              letterSpacing="1.5"
              fill="#E3C688"
            >
              <textPath
                href="#gl-arc-bottom"
                startOffset="50%"
                textAnchor="middle"
              >
                geoLARP.com
              </textPath>
            </text>
          </g>

          <g id="gl-globe">
            <circle cx="200" cy="200" r="146" fill="#17100A" />
            <g fill="none" stroke="#5C4526" strokeWidth="3.5">
              <ellipse cx="200" cy="200" rx="48" ry="145" />
              <ellipse cx="200" cy="200" rx="99" ry="145" />
              <ellipse cx="200" cy="200" rx="145" ry="48" />
              <ellipse cx="200" cy="200" rx="145" ry="99" />
              <path d="M200,55 L200,345" />
            </g>
            <path
              d="M55,200 L345,200"
              fill="none"
              stroke="var(--geo-accent)"
              strokeWidth="4"
              opacity="0.7"
            />
          </g>

          <g id="gl-die">
            <g transform="translate(6,8)" opacity="0.45">
              <path
                d="M200,114 L267.2,146.4 L283.8,219.1 L237.3,277.5 L162.7,277.5 L116.2,219.1 L132.8,146.4 Z"
                fill="#090603"
              />
            </g>
            <g stroke="#2A1C0E" strokeWidth="3.5" strokeLinejoin="round">
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
            <path
              d="M200.0,155.3 L234.9,172.1 L243.6,209.9 L219.4,240.3 L180.6,240.3 L156.4,209.9 L165.1,172.1 Z"
              fill="#F5E7C6"
              stroke="#2A1C0E"
              strokeWidth="5"
              strokeLinejoin="round"
            />
            <path
              d="M200,114 L267.2,146.4 L283.8,219.1 L237.3,277.5 L162.7,277.5 L116.2,219.1 L132.8,146.4 Z"
              fill="none"
              stroke="#2A1C0E"
              strokeWidth="8"
              strokeLinejoin="round"
            />
            <text
              x="200"
              y="222"
              textAnchor="middle"
              fontFamily="Archivo, sans-serif"
              fontWeight="900"
              fontSize="62"
              fill="#2A1C0E"
            >
              7
            </text>
          </g>

          <g id="gl-cog">
            <circle
              cx="200"
              cy="200"
              r="150"
              fill="none"
              stroke="#8A6A26"
              strokeWidth="46"
              strokeDasharray="34 44"
            />
            <circle
              cx="200"
              cy="200"
              r="128"
              fill="none"
              stroke="#7A5C20"
              strokeWidth="26"
            />
            <circle
              cx="200"
              cy="200"
              r="104"
              fill="none"
              stroke="#8A6A26"
              strokeWidth="10"
            />
            <circle
              cx="200"
              cy="200"
              r="34"
              fill="none"
              stroke="#8A6A26"
              strokeWidth="20"
            />
            <g stroke="#7A5C20" strokeWidth="14">
              <path d="M200,66 L200,334 M66,200 L334,200 M105,105 L295,295 M295,105 L105,295" />
            </g>
          </g>
        </defs>
      </svg>

      <div className="gl-bg">
        <div className="gl-bg-wash" />
        <div className="gl-bg-hatch" />
        <svg
          viewBox="0 0 400 400"
          width="520"
          height="520"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: -170,
            top: -130,
            opacity: 0.28,
            animation: 'gl-spin 90s linear infinite',
            transformOrigin: '50% 50%',
          }}
        >
          <use href="#gl-cog" />
        </svg>
        <svg
          viewBox="0 0 400 400"
          width="360"
          height="360"
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: -90,
            bottom: -110,
            opacity: 0.24,
            animation: 'gl-spin-rev 62s linear infinite',
            transformOrigin: '50% 50%',
          }}
        >
          <use href="#gl-cog" />
        </svg>
        <svg
          viewBox="0 0 400 400"
          width="1000"
          height="1000"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '46%',
            margin: '-500px 0 0 -500px',
            opacity: 0.07,
            animation: 'gl-spin-rev 300s linear infinite',
            transformOrigin: '50% 50%',
          }}
        >
          <use href="#gl-globe" />
        </svg>
      </div>

      <div className="gl-content">
        <section className="gl-hero" aria-labelledby="home-title">
          <div className="gl-top">
            <div className="gl-mark-small">
              <svg
                viewBox="0 0 400 400"
                width="100%"
                height="100%"
                role="img"
                aria-label="geoLARP.com mark"
              >
                <g className="gl-spin">
                  <use href="#gl-bezel" />
                </g>
                <g className="gl-spin-rev">
                  <use href="#gl-globe" />
                </g>
                <use href="#gl-die" />
              </svg>
            </div>
            <p className="gl-wordmark" aria-hidden="true">
              <span>geoLARP</span>
              <span>.com</span>
            </p>
          </div>

          <h1 id="home-title" className="gl-h1">
            The street outside is the board. Your phone is the{' '}
            <em>character&nbsp;sheet.</em>
          </h1>
          <p className="gl-lede" style={{ margin: '18px 0 22px' }}>
            geoLARP is live action role-playing on real ground. Walk somewhere,
            and something is there: that patch of the map and today&rsquo;s date
            decide it. You roll seven-sided dice, and you keep your character in
            your own phone.
          </p>
          <div className="gl-doors">
            <Link className="gl-door gl-door-main" href="/play">
              Open the character sheet
            </Link>
            <Link
              className="gl-door gl-door-alt"
              href="/blog/the-world-is-the-board"
            >
              Read how it works
            </Link>
          </div>
        </section>

        <section aria-labelledby="home-how">
          <h2 id="home-how" className="gl-h2">
            Three ideas, no&nbsp;installs
          </h2>
          <ol className="gl-steps">
            <li className="gl-step">
              <b>The world is the grid</b>
              <span>
                The map is cut into 100-metre cells. Each cell and each day
                hashes to what you meet there, so nobody has to place it.
              </span>
            </li>
            <li className="gl-step">
              <b>Seven-sided dice</b>
              <span>
                Ratings are dice codes like 3D+2. You roll that many d7s plus a
                wild die, and beat the difficulty.
              </span>
            </li>
            <li className="gl-step">
              <b>A second chance, earned</b>
              <span>
                Character Points buy an extra die or a reroll after a miss. You
                can earn five a day, and no more.
              </span>
            </li>
          </ol>
        </section>

        <section aria-labelledby="home-sheet">
          <h2 id="home-sheet" className="gl-h2">
            A character sheet, in full
          </h2>
          <p className="gl-note">
            This is the whole sheet: five attributes and twenty skills, one per
            line. Here is a sample character you can read. Making your own takes
            under a minute.
          </p>
          <CharacterSheet character={SAMPLE} layout="list" sample />
          <div className="gl-doors" style={{ marginTop: 22 }}>
            <Link className="gl-door gl-door-main" href="/play">
              Make your own
            </Link>
          </div>
        </section>

        <div className="gl-foot">
          <p style={{ margin: 0 }}>
            No account, no sign-in and no location. Your characters stay in this
            browser, and you can save each one as a file.{' '}
            <Link href="/app-privacy">Read the privacy promise</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
