'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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
    <Modal open={ranksModalOpen} onClose={closeRanks} title="Ранги" size="xl">
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px] p-1">
          <RankList
            ranks={ranks}
            locale={locale}
            currentRankId={progress?.current?.id ?? null}
            totalWageredMinor={progress?.totalWageredMinor}
          />
          {progress && (
            <RankProgressCard progress={progress} locale={locale} />
          )}
        </div>
      )}
    </Modal>
  );
}
