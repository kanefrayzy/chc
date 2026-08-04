import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@chcgreen/ui';

export const dynamic = 'force-dynamic';

interface FaqPageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: FaqPageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'faq' });
  return { title: t('pageTitle') };
}

/**
 * Порядок вопросов на странице. Сами тексты живут в файлах локализации,
 * поэтому их можно править из админки, не пересобирая сайт.
 */
const ITEMS = [
  'deposit',
  'methods',
  'withdrawTime',
  'codes',
  'enterCode',
  'history',
  'safety',
  'fair',
] as const;

export default async function FaqPage({ params }: FaqPageProps): Promise<JSX.Element> {
  const t = await getTranslations({ locale: params.locale, namespace: 'faq' });

  return (
    <AppShell locale={params.locale}>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-text-primary">{t('pageTitle')}</h1>
        <p className="mt-2 text-text-secondary">{t('subtitle')}</p>
        <div className="mt-8 space-y-3">
          {ITEMS.map((key) => (
            <Card key={key} variant="elevated" padding="md">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                  <span className="text-base font-semibold text-text-primary">
                    {t(`items.${key}.q`)}
                  </span>
                  <span
                    aria-hidden
                    className="mt-1 text-text-secondary transition-transform group-open:rotate-180"
                  >
                    ▾
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {t(`items.${key}.a`)}
                </p>
              </details>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
