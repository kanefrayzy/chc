'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, type AdminMessage, type TicketStatus } from '../../../../lib/api/admin';
import { ApiException } from '../../../../lib/api/client';
import { formatDateTime } from '../../../../lib/format';
import { Button } from '../../../../components/ui/Button';
import { Textarea } from '../../../../components/ui/Input';
import { cn } from '../../../../lib/cn';

export function TicketConversation({
  ticketId,
  initialMessages,
  ticketStatus,
}: {
  ticketId: string;
  initialMessages: AdminMessage[];
  ticketStatus: TicketStatus;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState('');
  const [status, setStatus] = useState(ticketStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (body.trim().length < 1) return;
    setLoading(true);
    setError(null);
    try {
      const msg = await adminApi.tickets.send(ticketId, { body: body.trim() });
      setMessages((prev) => [...prev, msg]);
      setBody('');
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  }

  async function close() {
    setLoading(true);
    setError(null);
    try {
      await adminApi.tickets.close(ticketId);
      setStatus('CLOSED');
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Ошибка закрытия');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 mb-4">
        {messages.length === 0 && (
          <div className="text-center text-sm text-ink-500 py-8">Сообщений нет</div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      {status !== 'CLOSED' ? (
        <form onSubmit={send} className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Ответ пользователю…"
          />
          {error && <div className="text-sm text-danger">{error}</div>}
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={close} disabled={loading}>
              Закрыть тикет
            </Button>
            <Button type="submit" loading={loading} disabled={body.trim().length === 0}>
              Отправить
            </Button>
          </div>
        </form>
      ) : (
        <div className="text-center text-sm text-ink-500 py-4 border-t border-border">
          Тикет закрыт
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: AdminMessage }) {
  const isStaff = message.authorRole === 'MODERATOR' || message.authorRole === 'SUPER_ADMIN';
  const isSystem = message.kind === 'SYSTEM' || message.kind === 'ACTION';

  if (isSystem) {
    return (
      <div className="text-center">
        <span className="inline-block text-xs px-3 py-1 bg-page text-ink-500 rounded border border-border">
          {message.body}
          <span className="ml-2 text-ink-400">· {formatDateTime(message.createdAt)}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex', isStaff ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm',
          isStaff
            ? 'bg-primary text-white rounded-br-sm'
            : 'bg-page text-ink-900 border border-border rounded-bl-sm',
        )}
      >
        <div className={cn('text-xs mb-0.5', isStaff ? 'text-white/70' : 'text-ink-400')}>
          {message.authorUsername ?? 'Без автора'} · {formatDateTime(message.createdAt)}
        </div>
        <div className="whitespace-pre-wrap break-words">{message.body}</div>
      </div>
    </div>
  );
}
