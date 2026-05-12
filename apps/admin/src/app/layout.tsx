import type { Metadata } from 'next';
import './globals.css';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'CHCGREEN';

export const metadata: Metadata = {
  title: `Admin · ${siteName}`,
  description: 'CHCGREEN admin panel',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="ru" className="dark">
      <body>{children}</body>
    </html>
  );
}
