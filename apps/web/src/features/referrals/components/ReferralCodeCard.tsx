'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Button, Badge } from '@chcgreen/ui';

export interface ReferralCodeCardProps {
  code: string;
  shareUrl: string;
}

export function ReferralCodeCard({ code, shareUrl }: ReferralCodeCardProps): JSX.Element {
  const t = useTranslations('referrals.code');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [, startTransition] = useTransition();

  const copy = (text: string, kind: 'code' | 'link'): void => {
    startTransition(async () => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(kind);
        setTimeout(() => setCopied(null), 1500);
      } catch {
        /* noop */
      }
    });
  };

  return (
    <Card variant="elevated" padding="lg">
      <CardHeader>
        <h3 className="text-lg font-semibold text-text-primary">{t('title')}</h3>
        <p className="mt-1 text-sm text-text-secondary">{t('description')}</p>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-text-muted">{t('codeLabel')}</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-border bg-bg-elevated px-3 py-2 font-mono text-base text-text-primary">
                {code}
              </div>
              <Button variant="secondary" type="button" onClick={() => copy(code, 'code')}>
                {copied === 'code' ? t('copied') : t('copy')}
              </Button>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-text-muted">{t('linkLabel')}</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 truncate rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-secondary">
                {shareUrl}
              </div>
              <Button variant="secondary" type="button" onClick={() => copy(shareUrl, 'link')}>
                {copied === 'link' ? t('copied') : t('copy')}
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="success">{t('rates.fromLoss')}</Badge>
            <Badge variant="brand">{t('rates.fromWin')}</Badge>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
