'use client';

import dynamic from 'next/dynamic';

// Client-only: the whole surface reads `localStorage`. Rendering it on the
// server would produce a sheet for a character the browser has not been asked.
const PlaySheet = dynamic(() => import('@/components/game/PlaySheet'), {
  ssr: false,
  loading: () => (
    <p className="text-base-content" role="status">
      Loading your characters…
    </p>
  ),
});

export default function PlayClient() {
  return <PlaySheet />;
}
