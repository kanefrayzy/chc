'use client';

import { useEffect, useState } from 'react';
import { Modal, Spinner } from '@chcgreen/ui';
import { useUi } from './ui-context';
import { RankList } from '@/features/ranks/components/RankList';
import { RankProgressCard } from '@/features/ranks/components/RankProgressCard';
import { ranksApi, type MyRankProgressDto } from '@/lib/api/ranks';
import type { RankDto } from '@/lib/api/ranks';

export interface RanksModalProps {
  locale: string;
  isAuthed: boolean;
}

export function RanksModal({ locale, isAuthed }: RanksModalProps): JSX.Element {
  const { ranksModalOpen, closeRanks } = useUi();
  const [ranks, setRanks] = useState<RankDto[]>([]);
  const [progress, setProgress] = useState<MyRankProgressDto | null>(null);
  const [loading, setLoading] = useState(false);

  // Загружаем данные при первом открытии
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
      } catch { /* */ } finally {
        setLoading(false);
      }
    };
    void load();
  }, [ranksModalOpen, isAuthed, ranks.length]);

  return (
    <Modal
      open={ranksModalOpen}
      onClose={closeRanks}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-purple/15 text-accent-purple">
            🏆
          </span>
          <span>Ранги</span>
        </span>
      }
      description="Чем больше ставите — выше ранг и бонусы"
    >
      <div className="-mx-6 -my-5 bg-bg-elevated px-6 py-5 space-y-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <>
            {progress ? (
              <RankProgressCard progress={progress} locale={locale} />
            ) : null}
            <div className="rounded-xl border border-border bg-bg-card p-3">
              <RankList
                ranks={ranks}
                locale={locale}
                currentRankId={progress?.current?.id ?? null}
                totalWageredMinor={progress?.totalWageredMinor}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
