import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  alternates: { canonical: '/app-privacy/' },
  openGraph: { url: '/app-privacy/' },
  title: 'App Privacy - geoLARP',
  description:
    'geoLARP is for adults, and everyone who plays shares their exact location.',
};

/**
 * The privacy policy the App Store listing links (geoLARP-Expo
 * appstore/listing.en-US.json, privacyPolicyUrl).
 *
 * The owner's rule, 2026-10-10: "kids can't play, everyone shares their full location
 * all the time", and "if you don't want to share your fucking location don't play".
 * No rounding, no "close enough". docs/privacy/location-intent.md has the reasoning;
 * tests/unit/app-privacy-page.test.tsx pins the promises.
 */
export default function AppPrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8 md:py-12">
      <header>
        <h1 className="mb-6 !text-2xl font-bold sm:mb-8 sm:!text-4xl md:!text-5xl">
          App Privacy
        </h1>
      </header>

      <article className="sh-doc">
        <p>
          How geoLARP uses your location, in the app and on this website.
          Website accounts are covered by our{' '}
          <Link href="/privacy" className="link-hover link">
            Privacy Policy
          </Link>
          .
        </p>

        <section className="mb-8">
          <h2>Who can play</h2>
          <p>
            <strong>geoLARP is for adults, 18 and over.</strong> Children cannot
            play. See the{' '}
            <Link href="/terms" className="link-hover link">
              Terms of Service
            </Link>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2>Your location is shared</h2>
          <p>
            geoLARP is played with other people, on real streets.{' '}
            <strong>
              Everyone who plays shares their exact location with the other
              players and game masters, all the time.
            </strong>{' '}
            The app uses the most precise position your phone can give.
          </p>
          <p>
            <strong>
              If you don&apos;t want to share your location, don&apos;t play.
            </strong>
          </p>
          <p>
            No history of where you went is kept. The App Store lists this as
            &ldquo;Precise Location&rdquo;.
          </p>
          <p>
            <strong>Playing needs a geoLARP account</strong>, so players know
            who is who. Deleting your account removes what is tied to it; see
            the{' '}
            <Link href="/privacy" className="link-hover link">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2>On this website</h2>
          <p>
            The map page loads map pictures from a map provider (OpenStreetMap
            or CARTO), which sees the area you are looking at, as any online map
            does.
          </p>
        </section>

        <section className="mb-8">
          <h2>What we never do with your location</h2>
          <p>
            We do not sell it or use it for advertising, and we share it only
            with the people playing.
          </p>
        </section>

        <section className="mb-8">
          <h2>Contact</h2>
          <p>
            Questions go through our{' '}
            <Link href="/contact" className="link-hover link">
              contact page
            </Link>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
