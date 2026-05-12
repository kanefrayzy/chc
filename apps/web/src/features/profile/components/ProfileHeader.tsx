import { Card, Badge } from '@chcgreen/ui';
import type { PublicUser } from '@chcgreen/shared';

export interface ProfileHeaderProps {
  user: PublicUser;
  /** Локализованный лейбл «Реферальный код». */
  referralLabel: string;
  /** Локализованный лейбл «Роль». */
  roleLabel: string;
  /** Локализованный лейбл «На сайте с». */
  memberSinceLabel: string;
  locale: string;
}

export function ProfileHeader({
  user,
  referralLabel,
  roleLabel,
  memberSinceLabel,
  locale,
}: ProfileHeaderProps): JSX.Element {
  const createdAt = new Date(user.createdAt).toLocaleDateString(
    locale === 'az' ? 'az-AZ' : 'ru-RU',
    { day: '2-digit', month: 'long', year: 'numeric' },
  );

  return (
    <Card variant="elevated" padding="lg">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-bold text-text-primary">
            @{user.username}
          </h2>
          <p className="text-sm text-text-secondary">{user.email}</p>
        </div>
        <Badge variant={user.role === 'USER' ? 'neutral' : 'purple'}>
          {roleLabel}: {user.role}
        </Badge>
      </div>
      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-secondary">
            {referralLabel}
          </dt>
          <dd className="mt-1 font-mono text-text-primary">{user.referralCode}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-text-secondary">
            {memberSinceLabel}
          </dt>
          <dd className="mt-1 text-text-primary">{createdAt}</dd>
        </div>
      </dl>
    </Card>
  );
}
