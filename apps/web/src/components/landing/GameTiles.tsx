import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getPublicSettings } from '@/lib/api/settings';

export interface GameTilesProps {
  locale: string;
}

interface Tile {
  key: 'roulette' | 'ranks' | 'referrals';
  href: string;
  enabled: boolean;
  accent: string;
  emoji: string;
}

export async function GameTiles({ locale }: GameTilesProps): Promise<JSX.Element | null> {
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;
  const t = await getTranslations({ locale, namespace: 'landing' });
  const settings = await getPublicSettings();

  const tiles: Tile[] = [
    {
      key: 'roulette',
      href: '/roulette',
      enabled: settings['gameplay.roulette_enabled'],
      accent: 'from-brand/25 to-accent-purple/10',
      emoji: '🎰',
    },
    {
      key: 'ranks',
      href: '/ranks',
      enabled: settings['gameplay.ranks_enabled'],
      accent: 'from-warning/25 to-bg-card-hover',
      emoji: '🏆',
    },
    {
      key: 'referrals',
      href: '/referrals',
      enabled: settings['gameplay.referrals_enabled'],
      accent: 'from-info/25 to-bg-card-hover',
      emoji: '🤝',
    },
  ];

  const visible = tiles.filter((tile) => tile.enabled);
  if (visible.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-text-primary">{t('gamesTitle')}</h2>
          <p className="text-sm text-text-secondary">{t('gamesSubtitle')}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((tile) => (
          <Link
            key={tile.key}
            href={`${localePrefix}${tile.href}`}
            className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${tile.accent} p-5 transition-all hover:border-brand/40 hover:shadow-glow`}
          >
            <div className="flex items-start justify-between">
              <div className="text-4xl drop-shadow" aria-hidden>
                {tile.emoji}
              </div>
              <span className="rounded-full bg-bg-base/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand">
                {t(`games.${tile.key}.badge`)}
              </span>
            </div>
            <div className="mt-8">
              <h3 className="text-lg font-bold text-text-primary">{t(`games.${tile.key}.title`)}</h3>
              <p className="mt-1 text-sm text-text-secondary">
                {t(`games.${tile.key}.subtitle`)}
              </p>
            </div>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
              {t('playNow')}
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
