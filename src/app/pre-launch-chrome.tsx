'use client';

import { usePathname } from 'next/navigation';

/**
 * Hides the template's site chrome on the pre-launch landing page.
 *
 * geolarp.com is not open yet. The nav advertises DOCS, BLOG, PLAY, PRICING and
 * THEMES — routes that exist because they came with the template, describing a
 * product nobody can use. A "coming soon" page that ships a full product nav is
 * making a promise the site cannot keep, so `/` renders bare.
 *
 * Everything else keeps its chrome, because those routes are the template demo
 * and are reachable at /template.
 *
 * Deliberately NOT wrapped around `CookieConsent`: consent is a legal
 * obligation, not decoration, and it applies to the landing page too.
 */
export default function PreLaunchChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLanding = pathname === '/' || pathname === '';
  if (isLanding) return null;
  return <>{children}</>;
}
