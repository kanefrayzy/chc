'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Button, Alert, cn } from '@chcgreen/ui';
import { AmountInput, parseAmountToMinor } from '@/features/deposits/components/AmountInput';
import { rouletteApi, type RouletteColor } from '@/lib/api/roulette';
import { ApiException } from '@/lib/api/client';
import { COLOR_CLASSES } from '../constants';

const MIN_BET_MINOR = 100n;
const MAX_BET_MINOR = 100_000n;

const QUICK_AMOUNTS: bigint[] = [100n, 500n, 1_000n, 5_000n];

export interface BetPanelProps {
  balanceMinor: string;
  disabled?: boolean;
  multipliers: Record<RouletteColor, number>;
}

export function BetPanel({ balanceMinor, disabled, multipliers }: BetPanelProps): JSX.Element {
  const t = useTranslations('roulette.bet');
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingColor, setPendingColor] = useState<RouletteColor | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleBet = (color: RouletteColor): void => {
    setErrorMessage(null);
    const minor = parseAmountToMinor(amount);
    if (minor === null) return setErrorMessage(t('errors.invalidAmount'));
    if (minor < MIN_BET_MINOR || minor > MAX_BET_MINOR) {
      return setErrorMessage(t('errors.outOfRange'));
    }
    if (minor > BigInt(balanceMinor)) return setErrorMessage(t('errors.insufficient'));

    setPendingColor(color);
    startTransition(async () => {
      try {
        await rouletteApi.placeBet({ color, amountMinor: minor.toString() });
        router.refresh();
      } catch (err) {
        if (err instanceof ApiException) {
          if (err.message === 'NO_OPEN_ROUND') setErrorMessage(t('errors.noOpenRound'));
          else if (err.message === 'BETTING_CLOSED') setErrorMessage(t('errors.bettingClosed'));
          else if (err.message === 'INSUFFICIENT_FUNDS') setErrorMessage(t('errors.insufficient'));
          else setErrorMessage(err.message || t('errors.placeFailed'));
        } else setErrorMessage(t('errors.placeFailed'));
      } finally {
        setPendingColor(null);
      }
    });
  };

  return (
    <Card variant="elevated" padding="lg">
      <CardHeader>
        <h3 className="text-lg font-semibold text-text-primary">{t('title')}</h3>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          <AmountInput
            label={t('amountLabel')}
            value={amount}
            onChange={setAmount}
            disabled={disabled || isPending}
            minMinor={MIN_BET_MINOR}
            maxMinor={MAX_BET_MINOR}
          />
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((m) => (
              <button
                key={m.toString()}
                type="button"
                disabled={disabled || isPending}
                onClick={() => setAmount((Number(m) / 100).toFixed(2))}
                className="rounded-md border border-border px-3 py-1 text-xs text-text-secondary hover:border-brand hover:text-brand"
              >
                +{(Number(m) / 100).toFixed(0)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['BLACK', 'GREEN', 'RED'] as RouletteColor[]).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleBet(color)}
                disabled={disabled || isPending}
                className={cn(
                  'rounded-lg py-3 text-sm font-bold uppercase transition disabled:opacity-50',
                  COLOR_CLASSES[color],
                  pendingColor === color ? 'ring-2 ring-brand' : '',
                )}
              >
                <div>{t(`color.${color}`)}</div>
                <div className="text-[11px] opacity-80">×{multipliers[color]}</div>
              </button>
            ))}
          </div>
          {errorMessage ? <Alert variant="danger">{errorMessage}</Alert> : null}
        </div>
      </CardBody>
    </Card>
  );
}
