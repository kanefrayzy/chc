'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TicketIcon } from '@/components/icons';

export function RedeemCodeButton(): JSX.Element {
  const params = useParams<{ locale: string }>();
  const t = useTranslations('topbar');
  const locale = params?.locale ?? '';
  return (
    <Link
      href={`/${locale}/play`}
      className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      title={t('insertCode')}
    >
      <TicketIcon className="h-4 w-4" />
      <span>{t('insertCode')}</span>
    </Link>
  );
}
