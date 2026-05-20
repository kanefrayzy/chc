import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getPublicSettings } from '@/lib/api/settings';
import { RouletteIcon, DiceIcon, CaseIcon, BoltIcon, ArrowRightIcon } from '@/components/icons';

export interface GameTilesProps {
  locale: string;
}

interface Tile {
  key: 'roulette' | 'mines' | 'classic' | 'cases';
  href: string;
  enabled: boolean;
  comingSoon?: boolean;
  badge: 'live' | 'soon';
  icon: JSX.Element;
  gradient: string;
  accent: string;
  imageUrl?: string;
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
      badge: 'live',
      icon: <RouletteIcon className="h-12 w-12" />,
      gradient: 'from-brand/25 via-bg-card to-accent-purple/10',
      accent: 'text-brand',
      imageUrl: settings['landing.game_image_url.roulette'] || '',
    },
    {
      key: 'mines',
      href: '/mines',
      enabled: settings['gameplay.mines_enabled'] ?? true,
      badge: 'live',
      icon: <BoltIcon className="h-12 w-12" />,
      gradient: 'from-success/25 via-bg-card to-bg-card-hover',
      accent: 'text-success',
      imageUrl: settings['landing.game_image_url.mines'] || '',
    },
    {
      key: 'classic',
      href: '/classic',
      enabled: settings['gameplay.jackpot_enabled'] ?? false,
      badge: 'live',
      icon: <DiceIcon className="h-12 w-12" />,
      gradient: 'from-info/20 via-bg-card to-bg-card-hover',
      accent: 'text-info',
      imageUrl: settings['landing.game_image_url.classic'] || '',
    },
    {
      key: 'cases',
      href: '/cases',
      enabled: false,
      comingSoon: true,
      badge: 'soon',
      icon: <CaseIcon className="h-12 w-12" />,
      gradient: 'from-accent-purple/25 via-bg-card to-bg-card-hover',
      accent: 'text-accent-purple',
      imageUrl: settings['landing.game_image_url.cases'] || '',
    },
  ];

  if (tiles.every((t) => !t.enabled && !t.comingSoon)) return null;

  return (
    <section className="mt-8 sm:mt-10" aria-labelledby="games-title">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 id="games-title" className="text-xl font-bold text-text-primary sm:text-2xl">
            {t('gamesTitle')}
          </h2>
          <p className="text-sm text-text-secondary">{t('gamesSubtitle')}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => {
          const title = t(`games.${tile.key}.title`);
          const subtitle = t(`games.${tile.key}.subtitle`);
          const badgeText = tile.badge === 'live' ? t('badges.live') : t('badges.soon');
          const badgeClass =
            tile.badge === 'live'
              ? 'bg-danger/15 text-danger ring-1 ring-danger/30'
              : 'bg-bg-elevated text-text-muted ring-1 ring-border';

          const tileBody = (
            <>
              {tile.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tile.imageUrl}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity group-hover:opacity-60"
                />
              ) : null}
              <div className="relative flex items-start justify-between">
                <div className={`${tile.accent} drop-shadow`}>{tile.icon}</div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
                >
                  {badgeText}
                </span>
              </div>
              <div className="relative mt-8">
                <h3 className="text-lg font-bold text-text-primary sm:text-xl">{title}</h3>
                <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
              </div>
              <div className="relative mt-4 inline-flex items-center gap-1 text-sm font-semibold">
                <span className={tile.enabled ? tile.accent : 'text-text-muted'}>
                  {tile.enabled ? t('playNow') : t('badges.soon')}
                </span>
                {tile.enabled ? (
                  <ArrowRightIcon className={`h-4 w-4 ${tile.accent} transition-transform group-hover:translate-x-1`} />
                ) : null}
              </div>
            </>
          );

          const baseCls = `group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${tile.gradient} p-5 transition-all min-h-[200px] flex flex-col`;

          if (tile.enabled) {
            return (
              <Link
                key={tile.key}
                href={`${localePrefix}${tile.href}`}
                className={`${baseCls} hover:border-brand/40 hover:shadow-glow hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40`}
              >
                {tileBody}
              </Link>
            );
          }
          return (
            <div
              key={tile.key}
              aria-disabled="true"
              className={`${baseCls} opacity-80`}
            >
              {tileBody}
            </div>
          );
        })}
      </div>
    </section>
  );
}
