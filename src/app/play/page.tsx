import type { Metadata } from 'next';
import Link from 'next/link';
import PlayClient from './PlayClient';

export const metadata: Metadata = {
  title: 'Your character sheet — geoLARP',
  description:
    'Make a geoLARP character, roll its skills and keep it on your own phone. No account, no location, no sign-in.',
  alternates: { canonical: '/play/' },
  openGraph: { url: '/play/' },
};

/**
 * The MVP character sheet. Deliberately UNAUTHENTICATED and LOCAL-ONLY: the
 * characters live in this browser's storage and nothing here asks for an
 * account, a sign-in or a location.
 */
export default function PlayPage() {
  return (
    <main className="from-base-200 via-base-100 to-base-200 bg-gradient-to-br py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-base-content mb-1 text-[clamp(1.4rem,7vw,1.875rem)] font-bold">
            {/* No-break spaces: three words stay on one line, never one word alone. */}
            Your&nbsp;character&nbsp;sheet
          </h1>
          <nav aria-label="Breadcrumb" className="text-base-content text-sm">
            <Link href="/" className="text-primary underline">
              Home
            </Link>
            <span aria-hidden="true"> / play</span>
          </nav>
        </header>
        <div className="mx-auto max-w-2xl">
          <PlayClient />
        </div>
      </div>
    </main>
  );
}
