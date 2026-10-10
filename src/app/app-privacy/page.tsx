import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  alternates: { canonical: '/app-privacy/' },
  openGraph: { url: '/app-privacy/' },
  title: 'App Privacy - geoLARP',
  description:
    'How the geoLARP app uses your location, playing solo and playing with others.',
};

/**
 * The privacy policy the App Store listing links (geoLARP-Expo
 * appstore/listing.en-US.json, privacyPolicyUrl).
 *
 * Every claim here is a claim about code in another repo or a decision recorded
 * in docs/privacy/location-intent.md, which lists the source for each one. It
 * describes the game as designed, in its two modes. Playing with others is the
 * owner's design: adult players near each other can see each other
 * (a radar), each player can turn it off, block players or keep it within one game
 * master's game, the game can hide them (cloaking, fog of war), and a game master
 * sees their players' exact positions. Shared live, never kept.
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
          <h2>Playing solo</h2>
          <p>
            <strong>Your exact location, when you ask.</strong> When you press
            &ldquo;Find my cell&rdquo;, the app asks your phone for the most
            precise position it can give, and the game uses all of it. What is
            there comes from the 100-metre square you are standing in; where you
            are within it is exact. The app never uses your location in the
            background.
          </p>
          <p>
            <strong>Nothing is sent.</strong> Playing solo, your position never
            leaves your phone, and nothing about you or your character is sent
            to us or to anyone else. Tapping a link opens it in your browser.
          </p>
          <p>
            <strong>What stays on your phone.</strong> Your character and your
            diary. Neither includes a location. Deleting the app deletes them.
          </p>
          <p>
            Solo play needs no account, and there is no analytics, advertising,
            crash reporting or identifiers. Anyone 13 and over can play solo.
          </p>
        </section>

        <section className="mb-8">
          <h2>Playing with others</h2>
          <p>
            geoLARP is at its best when the players around you might be anywhere
            nearby.
          </p>
          <p>
            <strong>It is for adults, 18 and over.</strong> If you are under 18,
            you play solo, and your position never leaves your phone.
          </p>
          <p>
            <strong>Other players near you may see where you are</strong>, for
            example on their radar when you are close by. That is part of the
            game: the players around you can, or might, know you are there.
          </p>
          <p>
            <strong>You control it.</strong> You can turn it off, block
            particular players, or share only with players in the same game
            master&apos;s game. The game can hide you too, with effects such as
            cloaking and fog of war.
          </p>
          <p>
            <strong>
              A game master sees exactly where the players in their game are
            </strong>
            , because they need it to run the game. Know your game master: join
            only games run by someone you know and trust.
          </p>
          <p>
            <strong>It is shared only while you play.</strong> When you stop
            playing or a game ends, the server forgets where you were, and no
            history of where you went is kept.
          </p>
          <p>
            <strong>Playing with others needs a geoLARP account</strong>, so
            players and game masters know who is who. Deleting your account
            removes what is tied to it; see the{' '}
            <Link href="/privacy" className="link-hover link">
              Privacy Policy
            </Link>
            .
          </p>
          <p>
            The App Store lists this as &ldquo;Precise Location&rdquo;, because
            a game master can see your exact position.
          </p>
        </section>

        <section className="mb-8">
          <h2>Playing on this website</h2>
          <p>
            In your browser the game uses your location to play, and your
            position is not sent to us. The map page loads map pictures from a
            map provider (OpenStreetMap or CARTO), which sees the area you are
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
            . Playing with others is for adults only.
          </p>
        </section>

        <section className="mb-8">
          <h2>What we never do with your location</h2>
          <p>
            We do not sell it, use it for advertising, or share it with anyone
            but the players and game masters described above.
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
