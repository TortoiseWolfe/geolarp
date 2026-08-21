import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify Email - geoLARP',
  description: 'Verify your email address for geoLARP',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function VerifyEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
