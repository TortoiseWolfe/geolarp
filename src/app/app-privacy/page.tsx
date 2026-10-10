import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  alternates: { canonical: '/app-privacy/' },
  openGraph: { url: '/app-privacy/' },
  title: 'App Privacy - geoLARP',
  description:
    'What the geoLARP app does with your location: today, and when game-master games arrive.',
};

/**
 * The privacy policy the App Store listing links (geoLARP-Expo
 * appstore/listing.en-US.json, privacyPolicyUrl).
 *
 * Every claim here is a claim about code in another repo or a decision recorded
 * in docs/privacy/location-intent.md, which lists the source for each one. It
 * describes the game as intended, game-master games included, because the owner
 * chose that on 2026-10-10; the part not yet built says so in its heading.
 * tests/unit/app-privacy-page.test.tsx pins the promises.
 */
export default function AppPrivacyPage() {
  const lastUpdated = '2026-10-10';

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8 md:py-12">
      <header>
        <h1 className="mb-6 !text-2xl font-bold sm:mb-8 sm:!text-4xl md:!text-5xl">
          App Privacy
        </h1>
      </header>

      <article className="sh-doc">
        <p className="text-base-content mb-6 text-sm">
          Last updated: {lastUpdated}
        </p>
        <p>
          This covers the geoLARP app, and how the game uses your location in
          the app and on this website. Website accounts are covered by our{' '}
          <Link href="/privacy" className="link-hover link">
            Privacy Policy
          </Link>
          .
        </p>

        <section className="mb-8">
          <h2>What this version of the app does</h2>
          <p>
            <strong>Location, only when you ask.</strong> The app asks for your
            location only when you press &ldquo;Find my cell&rdquo;. It takes
            one reading, and on your phone, straight away, rounds it to the
            100-metre square it falls in. The game uses that square to decide
            what is there. Your exact position is never stored, shown or sent.
            The app never uses your location in the background.
          </p>
          <p>
            <strong>Nothing is sent.</strong> This version makes no network
            requests. Nothing about you, your character or your location is sent
            to us or to anyone else. Tapping a link opens it in your browser.
          </p>
          <p>
            <strong>What stays on your phone.</strong> Your character and your
            diary. Neither includes a location. Deleting the app deletes them.
          </p>
          <p>
            There is no account, and no analytics, advertising, crash reporting
            or identifiers.
          </p>
        </section>

        <section className="mb-8">
          <h2>Game-master games (coming in a later version)</h2>
          <p>
            A game-master game is run by a person, the game master, who needs to
            know where the players in their game are in order to run it. When
            these games arrive:
          </p>
          <ul>
            <li>
              <strong>They are for adults, 18 and over.</strong> If you are
              under 18, you play solo, and your position never leaves your
              phone.
            </li>
            <li>
              <strong>What is shared is your current 100-metre square</strong>,
              never your exact position, and only with the game master of a game
              you chose to join. Other players do not see it.
            </li>
            <li>
              <strong>It is kept only while the game runs.</strong> When you
              leave the game or it ends, the server forgets your position. No
              history of where you went is kept.
            </li>
            <li>
              <strong>Joining needs a geoLARP account</strong>, so the game
              master knows who is who. Deleting your account removes what is
              tied to it; see the{' '}
              <Link href="/privacy" className="link-hover link">
                Privacy Policy
              </Link>
              .
            </li>
            <li>
              Nothing is shared until you join a game yourself, and you can
              leave at any time.
            </li>
          </ul>
          <p>
            The App Store lists this as &ldquo;Precise Location&rdquo;. A
            100-metre square is about as fine as the line Apple draws for that
            label, so we use it, even though an exact position is never sent.
          </p>
        </section>

        <section className="mb-8">
          <h2>Playing on this website</h2>
          <p>
            The game rounds your location the same way in your browser, and the
            square is not sent to us. The map page loads map pictures from a map
            provider (OpenStreetMap or CARTO), which sees the area you are
            looking at, as any online map does.
          </p>
        </section>

        <section className="mb-8">
          <h2>Who can play</h2>
          <p>
            geoLARP is for people aged 13 and over, or older where the law where
            you live sets a higher age; see the{' '}
            <Link href="/terms" className="link-hover link">
              Terms of Service
            </Link>
            . Game-master games are for adults only.
          </p>
        </section>

        <section className="mb-8">
          <h2>What we never do with your location</h2>
          <p>
            We do not sell it, use it for advertising, or share it with anyone
            outside a game you have joined.
          </p>
        </section>

        <section className="mb-8">
          <h2>Contact and changes</h2>
          <p>
            Questions go through our{' '}
            <Link href="/contact" className="link-hover link">
              contact page
            </Link>
            . When this page changes, the date above changes with it, and a
            change to what is shared will be in the app before it happens.
          </p>
        </section>
      </article>
    </main>
  );
}
