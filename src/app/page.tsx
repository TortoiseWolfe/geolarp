import type { Metadata } from 'next';
import ComingSoon from './coming-soon';

/**
 * The homepage claims `/` HERE, not in the root layout (#668) — 83 routes once
 * declared the homepage canonical because the layout claimed it for everyone.
 *
 * geolarp.com is pre-launch, so `/` is the Coming Soon page. The template's own
 * demo homepage still exists, moved to `/template`, and claims that path.
 */
export const metadata: Metadata = {
  title: 'geoLARP — coming soon',
  description:
    'geo-located live action role playing. Real geography, real play. Coming soon.',
  alternates: { canonical: '/' },
  openGraph: { url: '/' },
};

export default function HomePage() {
  return <ComingSoon />;
}
