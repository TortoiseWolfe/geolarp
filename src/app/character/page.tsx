'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

// Client-only: the whole surface reads `localStorage` and, if asked, the
// Geolocation API. Rendering it on the server would produce a sheet for a
// character the browser has not been consulted about.
const CharacterPlay = dynamic(() => import('@/components/game/CharacterPlay'), {
  ssr: false,
  // This fallback is frequently what the contrast sweep measures, so it uses
  // ordinary token colours rather than a dimmed placeholder.
  loading: () => (
    <p className="text-base-content" role="status">
      Loading your character…
    </p>
  ),
});

/**
 * The playable route. Deliberately UNAUTHENTICATED: a character is browser-
 * local by published promise, so requiring an account to reach one would
 * contradict the design rather than protect anything.
 */
export default function CharacterPage() {
  return (
    <main className="from-base-200 via-base-100 to-base-200 bg-gradient-to-br py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-base-content mb-1 text-3xl font-bold">
            Your character
          </h1>
          <nav aria-label="Breadcrumb" className="text-base-content text-sm">
            <Link href="/" className="text-primary underline">
              Home
            </Link>
            <span aria-hidden="true"> / character</span>
          </nav>
          <p className="text-base-content mt-3 max-w-2xl">
            geoLARP runs on a seven-sided die. Ratings are dice codes with pips
            — <span className="font-mono">3d7+2</span> — and one die in every
            pool is wild: on a seven it explodes, on a one something goes wrong
            anyway. The world is a grid of 100-metre cells, and what is in a
            cell comes from the place and the date, so everyone standing there
            today meets the same thing.
          </p>
        </header>

        <div className="mx-auto max-w-4xl">
          <CharacterPlay />
        </div>
      </div>
    </main>
  );
}
