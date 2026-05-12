import { useTranslations } from 'next-intl';

export const dynamic = 'force-dynamic';

export default function HomePage(): JSX.Element {
  const t = useTranslations();
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'CHCGREEN';

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👑</span>
          <span className="text-xl font-bold tracking-wide">{siteName}</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-xl border border-border px-4 py-2 text-sm text-text-primary hover:border-borderStrong">
            {t('common.login')}
          </button>
          <button className="btn-brand text-sm">{t('common.register')}</button>
        </div>
      </header>

      <section className="card mt-10 grid grid-cols-1 items-center gap-6 overflow-hidden bg-gradient-to-br from-bg-card to-bg-cardHover lg:grid-cols-2">
        <div className="space-y-6 p-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
            ⚡ {t('hero.badge')}
          </span>
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            <span className="block">{t('hero.title1')}</span>
            <span className="block">{t('hero.title2')}</span>
            <span className="block text-brand drop-shadow-[0_0_18px_rgba(0,255,136,0.4)]">
              {t('hero.title3')}
            </span>
          </h1>
          <p className="max-w-md text-text-secondary">{t('hero.subtitle')}</p>
          <button className="btn-brand">
            {t('hero.cta')} <span>→</span>
          </button>
        </div>
        <div className="hidden h-[360px] items-center justify-center lg:flex">
          <div className="relative h-72 w-72 rounded-full border border-brand/20 bg-bg-base shadow-[0_0_120px_rgba(0,255,136,0.15)]">
            <div className="absolute inset-6 rounded-full border border-brand/30" />
            <div className="absolute inset-12 rounded-full border-2 border-dashed border-brand/30" />
          </div>
        </div>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(
          [
            ['12 856', 'stats.playersOnline'],
            ['35 210', 'stats.gamesPlayed'],
            ['₼ 273 645.50', 'stats.totalWon'],
            ['₼ 72 540.00', 'stats.paidToday'],
          ] as const
        ).map(([value, key]) => (
          <div key={key} className="card">
            <div className="text-xl font-bold">{value}</div>
            <div className="mt-1 text-sm text-text-secondary">{t(key)}</div>
          </div>
        ))}
      </section>

      <footer className="mt-16 grid grid-cols-1 gap-4 border-t border-border pt-6 text-sm text-text-secondary sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ['features.fair.title', 'features.fair.subtitle'],
            ['features.fast.title', 'features.fast.subtitle'],
            ['features.support.title', 'features.support.subtitle'],
            ['features.ssl.title', 'features.ssl.subtitle'],
          ] as const
        ).map(([title, subtitle]) => (
          <div key={title} className="flex flex-col">
            <span className="font-semibold text-text-primary">{t(title)}</span>
            <span>{t(subtitle)}</span>
          </div>
        ))}
      </footer>
    </main>
  );
}
