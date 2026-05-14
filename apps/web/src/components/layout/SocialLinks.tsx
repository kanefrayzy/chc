import { TelegramIcon, InstagramIcon, DiscordIcon } from '@/components/icons';

export interface SocialLinksProps {
  telegram?: string;
  instagram?: string;
  discord?: string;
  className?: string;
}

const ICON_CLS = 'h-4 w-4';

export function SocialLinks({
  telegram,
  instagram,
  discord,
  className,
}: SocialLinksProps): JSX.Element | null {
  const items: { href: string; label: string; icon: JSX.Element }[] = [];
  if (telegram) items.push({ href: telegram, label: 'Telegram', icon: <TelegramIcon className={ICON_CLS} /> });
  if (instagram) items.push({ href: instagram, label: 'Instagram', icon: <InstagramIcon className={ICON_CLS} /> });
  if (discord) items.push({ href: discord, label: 'Discord', icon: <DiscordIcon className={ICON_CLS} /> });
  if (items.length === 0) return null;
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {items.map((it) => (
        <a
          key={it.label}
          href={it.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={it.label}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg-elevated text-text-secondary transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          {it.icon}
        </a>
      ))}
    </div>
  );
}
