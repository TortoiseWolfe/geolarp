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
          {/*
            The rules primer used to stand here unconditionally. It now lives
            inside `CharacterPlay` as a disclosure that opens for a player with
            no character and stays shut for one who has read it — which the
            route cannot decide, because whether a character exists is only
            known after `localStorage` is read on the client.
          */}
        </header>

        <div className="mx-auto max-w-4xl">
          <CharacterPlay />
        </div>
      </div>
    </main>
  );
}
