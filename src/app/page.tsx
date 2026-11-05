import type { Metadata } from 'next';
import Home from './home';

/**
 * The homepage claims `/` HERE, not in the root layout (#668) — 83 routes once
 * declared the homepage canonical because the layout claimed it for everyone.
 *
 * `/` is geoLARP's own front page: the pitch, a full sample character sheet,
 * and two doors (the post that explains the game, and the sheet at /play). The
 * template's own demo homepage still exists, moved to `/template`, and claims
 * that path.
 */
export const metadata: Metadata = {
  title: 'geoLARP: the street outside is the board',
  description:
    'Geo-located live action role-playing on seven-sided dice. Make a character in under a minute and keep it on your own phone: no account, no location.',
  alternates: { canonical: '/' },
  openGraph: { url: '/' },
};

export default function HomePage() {
  return <Home />;
}
