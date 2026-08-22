'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * geoLARP — Coming Soon.
 *
 * Ported from the Claude Design canvas file `geoLARP Coming Soon Steampunk.dc.html`.
 * The canvas wrapper (`<x-dc>`, `<helmet>`, `support.js`, the `DCLogic` props
 * class) is harness, not design, and is dropped. Its two props become the
 * constants below.
 *
 * `style-hover` / `style-focus` / `style-active` are Claude Design attributes
 * with no browser meaning, so those rules move into the stylesheet block where
 * they actually apply.
 *
 * The mark is three stacked layers, and the counter-rotation is the whole
 * effect: an outer brass bezel carrying the wordmark spins one way, a wireframe
 * globe spins the other, and the seven-sided die sits still in the middle. The
 * die alone is also the favicon — it is the only layer that survives 32px,
 * which is why the bezel is not the app icon.
 */

/** Brass. The canvas exposed this as a colour prop; there is one brand value. */
const ACCENT = '#E8B84B';

/** Seconds for one bezel revolution. Canvas default; 6–90 was the design range. */
const SPIN_SECONDS = 28;

export default function ComingSoon() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  );

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
          padding: 64px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
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

        .gl-panel {
          position: relative; width: min(760px, 100%);
          padding: 58px 56px 52px;
          border: 3px solid #8A6A26; border-radius: 6px;
          background: linear-gradient(#1C140Cf2, #120C07f2);
          box-shadow: inset 0 0 0 1px #E3C68840, inset 0 2px 40px #00000080, 0 30px 70px -20px #000000cc;
          display: flex; flex-direction: column; align-items: center;
          gap: 26px; text-align: center;
          animation: gl-fade 1s ease-out both;
        }
        .gl-panel-inner { position: absolute; inset: 11px; border: 1px solid #8A6A2666; border-radius: 3px; pointer-events: none; }
        .gl-rivet { position: absolute; width: 9px; height: 9px; border-radius: 999px;
          background: radial-gradient(circle at 34% 30%, #F0D69A, #7A5C20); }

        .gl-markwrap { position: relative; width: 276px; height: 276px; }
        .gl-markglow { position: absolute; inset: -22px; border-radius: 999px;
          background: radial-gradient(circle, var(--geo-accent) 0%, rgba(0,0,0,0) 68%);
          animation: gl-glow 6s ease-in-out infinite; }
        .gl-spin { animation: gl-spin var(--geo-spin) linear infinite; transform-origin: 200px 200px; transform-box: view-box; }
        .gl-spin-rev { animation: gl-spin-rev 52s linear infinite; transform-origin: 200px 200px; transform-box: view-box; }

        .gl-wordmark { display: flex; align-items: baseline;
          font-family: Spectral, Georgia, serif; font-weight: 800; font-size: 62px;
          letter-spacing: -1px; text-shadow: 0 2px 0 #00000066;
          animation: gl-rise 0.9s 0.2s ease-out both; }
        .gl-wordmark span:last-child { color: var(--geo-accent); }

        .gl-rule { display: flex; align-items: center; gap: 16px; animation: gl-rise 0.9s 0.4s ease-out both; }
        .gl-rule i { width: 64px; height: 1px; display: block; }
        .gl-rule .l { background: linear-gradient(90deg, rgba(0,0,0,0), #8A6A26); }
        .gl-rule .r { background: linear-gradient(90deg, #8A6A26, rgba(0,0,0,0)); }
        .gl-eyebrow { font-family: Cinzel, Georgia, serif; font-weight: 700; font-size: 15px;
          letter-spacing: 9px; text-transform: uppercase; color: var(--geo-accent); }

        .gl-form { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;
          margin-top: 4px; animation: gl-rise 0.9s 0.6s ease-out both; }
        .gl-input { width: 296px; height: 50px; padding: 0 16px;
          font-family: Spectral, Georgia, serif; font-size: 16px; color: #EFE2C6;
          background: #0E0905; border: 2px solid #8A6A26; border-radius: 3px; outline: none; }
        .gl-input:focus { border-color: #E3C688; }
        .gl-btn { height: 50px; padding: 0 28px;
          font-family: Cinzel, Georgia, serif; font-weight: 700; font-size: 14px;
          letter-spacing: 2.5px; text-transform: uppercase; color: #0C0805;
          background: linear-gradient(#F0D69A, #C79B36);
          border: 2px solid #7A5C20; border-radius: 3px; cursor: pointer;
          box-shadow: inset 0 1px 0 #FFF4D8, 0 2px 0 #5C4419; }
        .gl-btn:hover { background: linear-gradient(#F7E3B4, #D3A840); }
        .gl-btn:active { transform: translateY(1px); box-shadow: inset 0 1px 0 #FFF4D8; }
        .gl-sent { font-family: Spectral, Georgia, serif; font-size: 16px; color: var(--geo-accent); }
        .gl-error { font-family: Spectral, Georgia, serif; font-size: 15px; color: #d98b6a; flex-basis: 100%; margin-top: 10px; }

        /* The rings carry meaning, not decoration, but motion sensitivity wins. */
        @media (prefers-reduced-motion: reduce) {
          .gl-spin, .gl-spin-rev, .gl-markglow,
          .gl-panel, .gl-wordmark, .gl-rule, .gl-form { animation: none; }
        }
        @media (max-width: 640px) {
          .gl-panel { padding: 40px 22px 36px; }
          .gl-wordmark { font-size: 40px; }
          .gl-markwrap { width: 208px; height: 208px; }
          .gl-input { width: 100%; }
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

      <div className="gl-panel">
        <div className="gl-panel-inner" />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <span className="gl-rivet" style={{ left: 13, top: 13 }} />
          <span className="gl-rivet" style={{ right: 13, top: 13 }} />
          <span className="gl-rivet" style={{ left: 13, bottom: 13 }} />
          <span className="gl-rivet" style={{ right: 13, bottom: 13 }} />
        </div>

        <div className="gl-markwrap">
          <div className="gl-markglow" />
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

        <h1 className="gl-wordmark">
          <span>geoLARP</span>
          <span>.com</span>
        </h1>

        <div className="gl-rule">
          <i className="l" />
          <span className="gl-eyebrow">Coming soon</span>
          <i className="r" />
        </div>

        {state === 'sent' ? (
          <p className="gl-sent" role="status">
            You&rsquo;re on the list. We&rsquo;ll write once, when the gates
            open.
          </p>
        ) : (
          <form
            className="gl-form"
            onSubmit={async (e) => {
              e.preventDefault();
              // Normalising here is not cosmetic: email_signups CHECKs that the
              // stored value equals lower(btrim(email)), so an address typed with
              // capitals is rejected by the database rather than silently stored
              // twice in two cases.
              const address = email.trim().toLowerCase();
              if (!address) return;
              setState('sending');

              const { error } = await createClient()
                .from('email_signups')
                .insert({ email: address, source: 'coming-soon' });

              // 23505 is the unique violation -- this address is already on the
              // list. Show the same thing as a first-time signup: telling someone
              // "you already signed up" confirms list membership to anyone who can
              // type an address, and is of no use to the person who just typed it.
              if (error && error.code !== '23505') {
                setState('error');
                return;
              }
              setState('sent');
            }}
          >
            <input
              className="gl-input"
              type="email"
              required
              placeholder="you@email.com"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              className="gl-btn"
              type="submit"
              disabled={state === 'sending'}
            >
              {state === 'sending' ? 'Sending…' : 'Notify me'}
            </button>
            {state === 'error' && (
              <p className="gl-error" role="alert">
                That didn&rsquo;t save — the list is unreachable right now. Try
                again in a moment.
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
