'use client';

import { useTranslations } from 'next-intl';
import { Card, CardBody, Badge, cn } from '@chcgreen/ui';
import type { TicketDto } from '@/lib/api/tickets';

const STATUS_VARIANT: Record<TicketDto['status'], 'warning' | 'info' | 'success' | 'neutral'> = {
  OPEN: 'info',
  WAITING_USER: 'warning',
  WAITING_MODERATOR: 'info',
  CLOSED: 'neutral',
};

export interface TicketListItemProps {
  ticket: TicketDto;
  active: boolean;
  onSelect: (id: string) => void;
  locale: string;
}

export function TicketListItem({
  ticket,
  active,
  onSelect,
  locale,
}: TicketListItemProps): JSX.Element {
  const t = useTranslations('chat');
  return (
    <button
      type="button"
      onClick={() => onSelect(ticket.id)}
      className={cn(
        'w-full rounded-xl border p-3 text-left transition',
        active ? 'border-brand bg-bg-card-hover' : 'border-border hover:border-border-strong',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-text-primary">
            {ticket.subject ?? t(`type.${ticket.type}`)}
          </div>
          <div className="mt-1 truncate text-xs text-text-secondary">
            {ticket.lastMessagePreview ?? '—'}
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[ticket.status]}>{t(`status.${ticket.status}`)}</Badge>
      </div>
      <div className="mt-2 text-xs text-text-muted">
        {new Date(ticket.lastMessageAt ?? ticket.updatedAt).toLocaleString(
          locale === 'az' ? 'az-AZ' : 'ru-RU',
        )}
      </div>
    </button>
  );
}

export interface TicketListProps {
  tickets: TicketDto[];
  activeId: string | null;
  onSelect: (id: string) => void;
  locale: string;
}

export function TicketList({ tickets, activeId, onSelect, locale }: TicketListProps): JSX.Element {
  const t = useTranslations('chat');
  if (tickets.length === 0) {
    return (
      <Card variant="elevated">
        <CardBody className="text-center text-sm text-text-secondary">{t('list.empty')}</CardBody>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {tickets.map((tk) => (
        <TicketListItem
          key={tk.id}
          ticket={tk}
          active={tk.id === activeId}
          onSelect={onSelect}
          locale={locale}
        />
      ))}
    </div>
  );
}
