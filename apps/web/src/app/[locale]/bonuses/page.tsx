import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@chcgreen/ui';
import { getPublicSettings } from '@/lib/api/settings';

export const dynamic = 'force-dynamic';

interface BonusesPageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: BonusesPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'bonuses' });
  return { title: t('pageTitle') };
}

interface BonusItem {
  /** Ключ в файлах локализации: bonuses.items.<key> */
  key: 'firstDeposit' | 'cashback' | 'referral' | 'ranks';
  badge: string;
  tone: 'brand' | 'purple' | 'success' | 'info';
  /** Показывать только когда бонус на депозит включён настройкой. */
  depositBonus?: boolean;
}

const ITEMS: BonusItem[] = [
  { key: 'firstDeposit', badge: '100%', tone: 'brand', depositBonus: true },
  { key: 'cashback', badge: '5%', tone: 'purple' },
  { key: 'referral', badge: '10%', tone: 'success' },
  { key: 'ranks', badge: 'VIP', tone: 'info' },
];

const toneBg: Record<BonusItem['tone'], string> = {
  brand: 'bg-brand/15 text-brand border-brand/30',
  purple: 'bg-accent-purple/15 text-accent-purple border-accent-purple/30',
  success: 'bg-success/15 text-success border-success/30',
  info: 'bg-info/15 text-info border-info/30',
};

export default async function BonusesPage({ params }: BonusesPageProps): Promise<JSX.Element> {
  const [t, settings] = await Promise.all([
    getTranslations({ locale: params.locale, namespace: 'bonuses' }),
    getPublicSettings(),
  ]);
  const bonusBps = settings['deposit.bonus_bps'];
  const items = bonusBps > 0 ? ITEMS : ITEMS.filter((it) => !it.depositBonus);

  return (
    <AppShell locale={params.locale}>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-text-primary">{t('pageTitle')}</h1>
        <p className="mt-2 text-text-secondary">{t('subtitle')}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {items.map((it) => (
            <Card key={it.key} variant="elevated" padding="lg">
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border text-sm font-bold ${toneBg[it.tone]}`}
                >
                  {it.badge}
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-text-primary">
                    {t(`items.${it.key}.title`)}
                  </h3>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {t(`items.${it.key}.subtitle`)}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                    {t(`items.${it.key}.text`)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
