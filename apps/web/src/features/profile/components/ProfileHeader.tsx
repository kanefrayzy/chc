import { Card } from '@chcgreen/ui';
import type { PublicUser } from '@chcgreen/shared';
import { AvatarUpload } from './AvatarUpload';

export interface ProfileHeaderProps {
  user: PublicUser;
  /** Локализованный лейбл «На сайте с». */
  memberSinceLabel: string;
  locale: string;
}

export function ProfileHeader({
  user,
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
        <div className="flex items-center gap-4 min-w-0">
          <AvatarUpload username={user.username} currentAvatarUrl={user.avatarUrl} />
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold text-text-primary">
              @{user.username}
            </h2>
            <p className="text-sm text-text-secondary">{user.email}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-text-secondary">
            {memberSinceLabel}
          </div>
          <div className="mt-1 text-sm text-text-primary">{createdAt}</div>
        </div>
      </div>
    </Card>
  );
}
