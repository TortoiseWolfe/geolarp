import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { PrivacyActions } from '@/components/privacy/PrivacyActions';

export const metadata: Metadata = {
  // This route claims its own URL (#668).
  alternates: { canonical: '/privacy/' },
  openGraph: { url: '/privacy/' },
  title: 'Privacy Policy - geoLARP',
  description:
    'Learn how geoLARP protects your privacy and handles your personal information.',
};

export default function PrivacyPolicyPage() {
  // NOTE: sections 3–9 of this policy do not exist. The page jumps 2 → 10 and has
  // since it was written, while asserting GDPR compliance in section 1. Section 2
  // below was added by #585 because a retention period was being claimed in three
  // internal security audits and stated to users nowhere. The remaining gap is
  // legal content, not engineering, and is tracked separately — do not paper over
  // it by renumbering.
  const lastUpdated = '2026-08-06';

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8 md:py-12">
      <header>
        <h1 className="mb-6 !text-2xl font-bold sm:mb-8 sm:!text-4xl md:!text-5xl">
          Privacy Policy
        </h1>
      </header>

      {/* Quick Actions - Client Component */}
      <PrivacyActions />

      <article className="sh-doc">
        <p className="text-base-content mb-6 text-sm">
          Last updated: {lastUpdated}
        </p>
        <section className="mb-8">
          <h2>1. Introduction</h2>
          <p>
            Welcome to geoLARP. We are committed to protecting your privacy and
            ensuring you have a positive experience on our website. This privacy
            policy explains how we collect, use, and protect your personal
            information in compliance with the General Data Protection
            Regulation (GDPR) and other applicable privacy laws.
          </p>
        </section>
        <section className="mb-8">
          <h2>2. Data Retention</h2>
          <p>
            <strong>Security audit logs.</strong> We keep a record of
            security-relevant account events — sign-in, sign-out, password
            changes, email verification and similar — together with the IP
            address and browser user-agent they came from. These records are
            retained for <strong>90 days</strong> and are then deleted
            automatically. You can see your own entries; they are not visible to
            other users.
          </p>
          <p>
            <strong>Account data.</strong> Information tied to your account is
            kept for as long as the account exists. When you delete your
            account, records that reference it — including the security audit
            log entries above — are removed with it.
          </p>
        </section>
        <section className="mb-8">
          <h2>10. Children&apos;s Privacy</h2>
          <p>
            <strong>geoLARP is for people aged 13 and over.</strong> Where the
            law where you live sets a higher minimum age for consenting to
            online services or to the processing of your location &mdash;
            several EU and EEA countries set 16 under Article 8 GDPR &mdash;
            that higher age applies to you instead.
          </p>
          <p>
            We do not knowingly collect personal data from anyone below the age
            that applies to them. If you believe we have, contact us and we will
            delete it. The same minimum is stated in our{' '}
            <Link href="/terms" className="link-hover link">
              Terms of Service
            </Link>
            , which also covers playing safely.
          </p>
        </section>
        <section className="mb-8">
          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify
            you of any changes by posting the new policy on this page and
            updating the &ldquo;Last updated&rdquo; date. For significant
            changes, we may request renewed consent.
          </p>
        </section>
      </article>
    </main>
  );
}
