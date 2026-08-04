import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale, getTranslations } from 'next-intl/server';
import { Toaster } from 'sonner';
import { getPublicSettings } from '@/lib/api/settings';
import '../globals.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [settings, t] = await Promise.all([
    getPublicSettings(),
    getTranslations('common'),
  ]);
  const siteName =
    settings['brand.site_name'] || process.env.NEXT_PUBLIC_SITE_NAME || 'CHCGREEN';
  const logoUrl = settings['brand.logo_url'] || '';
  const description =
    settings['brand.tagline'] || t('tagline');

  return {
    title: { default: siteName, template: `%s · ${siteName}` },
    description,
    applicationName: siteName,
    manifest: '/manifest.json',
    icons: logoUrl
      ? { icon: logoUrl, apple: logoUrl, shortcut: logoUrl }
      : { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
    openGraph: {
      siteName,
      title: siteName,
      description,
      type: 'website',
      images: logoUrl ? [{ url: logoUrl }] : undefined,
    },
    twitter: {
      card: 'summary',
      title: siteName,
      description,
      images: logoUrl ? [logoUrl] : undefined,
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#07090c',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              },
            }}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
