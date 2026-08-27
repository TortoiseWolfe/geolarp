'use client';

import React from 'react';
import { PrivacyControls } from '@/components/privacy/PrivacyControls';
import { STORAGE_KEY as CHARACTER_KEY } from '@/lib/geolarp/character';
import Link from 'next/link';

export default function PrivacyControlsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8 md:py-12">
      <header>
        <h1 className="mb-8 !text-2xl font-bold sm:!text-4xl md:!text-5xl">
          Privacy Controls
        </h1>
        <div className="sh-doc mb-8">
          <p>
            Manage your privacy settings, export your data, and exercise your
            GDPR rights from this central control panel.
          </p>
        </div>
      </header>

      <section>
        {/*
          TWO FORK-SPECIFIC PROPS, both closing #37.

          `preserveLocalStorageKeys` — the delete removes every localStorage key
          not on an allowlist, and a geoLARP character lives in one. It is the
          player's own creation, not tracking data, and the published promise is
          that the game "will warn you rather than quietly lose it"
          (the-world-is-the-board.md:101-103). A privacy control silently
          destroying it is the opposite of that. Deleting a character is what
          "New character" on /character is for.

          `showConfirmation` — the component defaults it to FALSE, so the
          confirmation step it implements is dead code and the first click
          deletes. That default is a template defect filed upstream as
          TortoiseWolfe/ScriptHammer#955; passing it here does not wait for it.
        */}
        <PrivacyControls
          showConfirmation
          preserveLocalStorageKeys={[CHARACTER_KEY]}
        />
      </section>

      <nav
        className="mt-8 flex flex-wrap gap-4"
        aria-label="Related privacy pages"
      >
        <Link href="/privacy" className="btn btn-outline">
          Privacy Policy
        </Link>
        <Link href="/cookies" className="btn btn-outline">
          Cookie Policy
        </Link>
      </nav>
    </main>
  );
}
