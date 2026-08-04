import { redirect } from 'next/navigation';
import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest, getServerUser, isSuperAdmin } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { TranslationsEditor } from './TranslationsEditor';

export const dynamic = 'force-dynamic';

const LOCALES = ['ru', 'az'] as const;
type Locale = (typeof LOCALES)[number];

const LOCALE_NAMES: Record<Locale, string> = { ru: 'Русский', az: 'Azərbaycanca' };

interface Props {
  searchParams: { locale?: string };
}

export default async function TranslationsPage({ searchParams }: Props) {
  const me = await getServerUser();
  if (!isSuperAdmin(me)) redirect('/dashboard');

  const locale: Locale = LOCALES.includes((searchParams.locale ?? 'ru') as Locale)
    ? ((searchParams.locale ?? 'ru') as Locale)
    : 'ru';

  const cookie = cookieHeaderFromRequest();
  const data = await adminApi.translations.get(locale, { cookie });

  return (
    <>
      <PageHeader
        title="Переводы"
        subtitle="Тексты интерфейса по ключам. Правится только то, что вы меняете — остальное берётся из сборки, поэтому новые тексты не теряются."
      />

      {/* Locale tabs */}
      <div className="mb-6 flex gap-2">
        {LOCALES.map((loc) => (
          <a
            key={loc}
            href={`?locale=${loc}`}
            className={[
              'rounded-xl border px-5 py-2 text-sm font-semibold transition',
              loc === locale
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-border bg-surface text-ink-500 hover:bg-ink-50',
            ].join(' ')}
          >
            {LOCALE_NAMES[loc]}
          </a>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <TranslationsEditor locale={locale} entries={data.entries} isCustom={data.isCustom} />
      </div>
    </>
  );
}
