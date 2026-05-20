import { redirect } from 'next/navigation';
import { adminApi } from '../../../lib/api/admin';
import { cookieHeaderFromRequest, getServerUser, isSuperAdmin } from '../../../lib/api/server';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ClassicControls } from './ClassicControls';

export const dynamic = 'force-dynamic';

export default async function ClassicAdminPage() {
  const me = await getServerUser();
  if (!isSuperAdmin(me)) {
    redirect('/dashboard');
  }
  const cookie = cookieHeaderFromRequest();

  const settings = await adminApi.settings.list({ cookie });

  const find = (key: string): string =>
    String(settings.items.find((s) => s.key === key)?.value ?? '');
  const findNum = (key: string, def: number): number => {
    const v = settings.items.find((s) => s.key === key)?.value;
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v) return Number(v);
    return def;
  };

  const enabled =
    settings.items.find((s) => s.key === 'gameplay.jackpot_enabled')?.value !== false;
  const commissionBps = findNum('classic.commission_bps', 700);
  const minBetMinor = find('classic.min_bet_minor') || '100';
  const maxBetMinor = find('classic.max_bet_minor') || '10000000';
  const roundDurationSec = findNum('classic.round_duration_sec', 30);
  const rollingDurationSec = findNum('classic.rolling_duration_sec', 8);
  const minPlayersToStart = findNum('classic.min_players_to_start', 2);
  const forcedWinnerUserId = find('classic.forced_winner_user_id');

  return (
    <>
      <PageHeader
        title="Классический"
        subtitle="Настройки многопользовательского джекпота"
      />

      <ClassicControls
        currentEnabled={enabled}
        currentCommissionBps={commissionBps}
        currentMinBetMinor={minBetMinor}
        currentMaxBetMinor={maxBetMinor}
        currentRoundDurationSec={roundDurationSec}
        currentRollingDurationSec={rollingDurationSec}
        currentMinPlayersToStart={minPlayersToStart}
        currentForcedWinnerUserId={forcedWinnerUserId}
      />
    </>
  );
}
