'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardBody, Spinner } from '@chcgreen/ui';
import { RouletteWheel, ColorTotalsBadge } from './RouletteWheel';
import { RoundInfoCard } from './RoundInfoCard';
import { BetPanel } from './BetPanel';
import { BetsList } from './BetsList';
import { HistoryStrip } from './HistoryStrip';
import {
  rouletteApi,
  type RouletteBetDto,
  type RouletteColor,
  type RouletteRoundDto,
} from '@/lib/api/roulette';

const STATE_POLL_MS = 1500;
const HISTORY_POLL_MS = 5000;
const MY_BETS_POLL_MS = 4000;

const COLOR_ORDER: RouletteColor[] = ['BLACK', 'GREEN', 'RED'];

export interface RouletteLayoutProps {
  isAuthed: boolean;
  balanceMinor: string | null;
  locale: string;
}

export function RouletteLayout({ isAuthed, balanceMinor }: RouletteLayoutProps): JSX.Element {
  const t = useTranslations('roulette');
  const [round, setRound] = useState<RouletteRoundDto | null>(null);
  const [recentBets, setRecentBets] = useState<RouletteBetDto[]>([]);
  const [history, setHistory] = useState<RouletteRoundDto[]>([]);
  const [myBets, setMyBets] = useState<RouletteBetDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pull = async (): Promise<void> => {
      try {
        const s = await rouletteApi.state();
        if (cancelled) return;
        setRound(s.round);
        setRecentBets(s.recentBets);
      } catch {
        /* silent */
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(pull, STATE_POLL_MS);
        }
      }
    };
    pull();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pull = async (): Promise<void> => {
      try {
        const res = await rouletteApi.history(20);
        if (!cancelled) setHistory(res.items);
      } catch {
        /* silent */
      } finally {
        if (!cancelled) timer = setTimeout(pull, HISTORY_POLL_MS);
      }
    };
    pull();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pull = async (): Promise<void> => {
      try {
        const res = await rouletteApi.myBets(30);
        if (!cancelled) setMyBets(res.items);
      } catch {
        /* silent */
      } finally {
        if (!cancelled) timer = setTimeout(pull, MY_BETS_POLL_MS);
      }
    };
    pull();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isAuthed]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!round) {
    return (
      <Card variant="elevated">
        <CardBody className="text-center text-text-secondary">{t('noRound')}</CardBody>
      </Card>
    );
  }

  const canBet = isAuthed && round.status === 'BETTING';

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <RouletteWheel winningSlot={round.winningSlot} status={round.status} />
        <div className="grid grid-cols-3 gap-2">
          {COLOR_ORDER.map((color) => (
            <ColorTotalsBadge
              key={color}
              color={color}
              amountMinor={round.totals[color].amountMinor}
              betsCount={round.totals[color].betsCount}
              multiplier={round.multipliers[color]}
            />
          ))}
        </div>
        <HistoryStrip rounds={history} />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
              {t('bets.recentTitle')}
            </h3>
            <BetsList bets={recentBets} emptyKey="recent" />
          </div>
          {isAuthed ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
                {t('bets.mineTitle')}
              </h3>
              <BetsList bets={myBets} emptyKey="mine" />
            </div>
          ) : null}
        </div>
      </div>
      <div className="space-y-4">
        <RoundInfoCard round={round} />
        {isAuthed && balanceMinor !== null ? (
          <BetPanel
            balanceMinor={balanceMinor}
            disabled={!canBet}
            multipliers={round.multipliers}
          />
        ) : (
          <Card variant="elevated">
            <CardBody className="text-sm text-text-secondary">{t('loginToBet')}</CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
