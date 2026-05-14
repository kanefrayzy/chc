'use client';

import { useEffect, useState } from 'react';
import { Modal, Spinner } from '@chcgreen/ui';
import { useUi } from './ui-context';
import {
  TrophyIcon,
  CrownIcon,
  LockIcon,
  CheckCircleIcon,
  StarIcon,
} from '@/components/icons';
import { ranksApi, type MyRankProgressDto, type RankDto } from '@/lib/api/ranks';

export interface RanksModalProps {
  locale: string;
  isAuthed: boolean;
}

function tierStyle(order: number): { bg: string; text: string } {
  if (order >= 5) return { bg: 'bg-gradient-to-br from-emerald-400/30 to-cyan-400/30', text: 'text-emerald-300' };
  if (order === 4) return { bg: 'bg-gradient-to-br from-sky-400/30 to-indigo-400/30', text: 'text-sky-300' };
  if (order === 3) return { bg: 'bg-gradient-to-br from-yellow-400/30 to-amber-500/30', text: 'text-yellow-300' };
  if (order === 2) return { bg: 'bg-gradient-to-br from-slate-300/25 to-slate-500/25', text: 'text-slate-200' };
  return { bg: 'bg-gradient-to-br from-amber-700/30 to-orange-600/30', text: 'text-amber-300' };
}

function RankIcon({ rank, size = 32 }: { rank: RankDto; size?: number }): JSX.Element {
  if (rank.iconUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={rank.iconUrl}
        alt=""
        style={{ width: size, height: size }}
        className="rounded-md object-contain"
      />
    );
  }
  const t = tierStyle(rank.order);
  const Icon =
    rank.order >= 5 ? CrownIcon : rank.order >= 3 ? TrophyIcon : StarIcon;
  return (
    <span
      style={{ width: size, height: size }}
      className={`flex items-center justify-center rounded-md ${t.bg} ${t.text}`}
    >
      <Icon className="h-1/2 w-1/2" />
    </span>
  );
}

function formatThreshold(minor: string): string {
  return `${(Number(minor) / 100).toFixed(0)} AZN`;
}

export function RanksModal({ locale, isAuthed }: RanksModalProps): JSX.Element {
  const { ranksModalOpen, closeRanks } = useUi();
  const [ranks, setRanks] = useState<RankDto[]>([]);
  const [progress, setProgress] = useState<MyRankProgressDto | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ranksModalOpen || ranks.length > 0) return;
    setLoading(true);
    const load = async (): Promise<void> => {
      try {
        const [list, prog] = await Promise.all([
          ranksApi.list(),
          isAuthed ? ranksApi.me().catch(() => null) : Promise.resolve(null),
        ]);
        setRanks(list.items);
        setProgress(prog);
      } catch {
        /* */
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [ranksModalOpen, isAuthed, ranks.length]);

  const total = progress?.totalWageredMinor ? BigInt(progress.totalWageredMinor) : null;
  const pct = progress ? Math.min(100, progress.progressBps / 100) : 0;
  const currentName = progress?.current
    ? locale === 'az'
      ? progress.current.nameAz
      : progress.current.nameRu
    : null;
  const nextName = progress?.next
    ? locale === 'az'
      ? progress.next.nameAz
      : progress.next.nameRu
    : null;

  return (
    <Modal
      open={ranksModalOpen}
      onClose={closeRanks}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/15 text-brand"
          >
            <TrophyIcon className="h-4 w-4" />
          </span>
          <span>Ранги</span>
        </span>
      }
      description="Чем больше ставите — выше ранг"
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Прогресс */}
          {progress && (
            <div className="rounded-xl border border-border bg-bg-elevated/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {progress.current && (
                    <RankIcon rank={progress.current} size={28} />
                  )}
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-text-muted">
                      Текущий
                    </div>
                    <div className="truncate text-sm font-semibold text-text-primary">
                      {currentName ?? '—'}
                    </div>
                  </div>
                </div>
                {nextName ? (
                  <div className="text-right min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-text-muted">
                      Следующий
                    </div>
                    <div className="truncate text-sm font-medium text-text-secondary">
                      {nextName}
                    </div>
                  </div>
                ) : (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand">
                    MAX
                  </span>
                )}
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-gradient-to-r from-brand/70 to-brand transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-muted">
                <span>
                  Ставок:{' '}
                  {total !== null ? `${(Number(total) / 100).toFixed(0)} AZN` : '—'}
                </span>
                <span>{pct.toFixed(0)}%</span>
              </div>
            </div>
          )}

          {/* Список рангов */}
          <ul className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
            {ranks.map((r) => {
              const isCurrent = r.id === progress?.current?.id;
              const isReached =
                total !== null && BigInt(r.minWageredMinor) <= total;
              const name = locale === 'az' ? r.nameAz : r.nameRu;
              return (
                <li
                  key={r.id}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                    isCurrent
                      ? 'border-brand/60 bg-brand/10'
                      : isReached
                        ? 'border-border bg-bg-elevated/40'
                        : 'border-border bg-bg-card opacity-70'
                  }`}
                >
                  <RankIcon rank={r} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-text-primary">
                        {name}
                      </span>
                      <span className="text-[10px] font-mono text-text-muted">
                        #{r.order}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted">
                      от {formatThreshold(r.minWageredMinor)}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isCurrent ? (
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand">
                        Сейчас
                      </span>
                    ) : isReached ? (
                      <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <LockIcon className="h-4 w-4 text-text-muted" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
