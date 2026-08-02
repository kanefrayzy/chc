'use client';

import { useState, useEffect, useRef, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { adminApi, type AdminMessage, type TicketStatus } from '../../../../lib/api/admin';
import { ApiException } from '../../../../lib/api/client';
import { getAdminSocket } from '../../../../lib/realtime';
import { formatDateTime } from '../../../../lib/format';
import { Button } from '../../../../components/ui/Button';
import { Textarea } from '../../../../components/ui/Input';
import { cn } from '../../../../lib/cn';
import { playMessageSound } from '../../../../lib/sounds';

interface TicketConversationProps {
  ticketId: string;
  userId: string;
  initialMessages: AdminMessage[];
  ticketStatus: TicketStatus;
  oldestMessageId?: string | null;
  /** Панельный режим: компонент занимает всю высоту парента (flex-1) */
  panelMode?: boolean;
  /** Внешний триггер для открытия формы (block/credit/debit) */
  externalAction?: { type: 'block' | 'credit' | 'debit'; key: number } | null;
  /** Колбэк после успешной корректировки баланса */
  onBalanceUpdated?: (newBalanceMinor: string) => void;
}

export function TicketConversation({
  ticketId,
  userId,
  initialMessages,
  ticketStatus,
  oldestMessageId,
  panelMode = false,
  externalAction,
  onBalanceUpdated,
}: TicketConversationProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState('');
  const [status, setStatus] = useState(ticketStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 30);
  const [cursorId, setCursorId] = useState<string | null>(initialMessages[0]?.id ?? null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Индикатор печатания
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Корректировка баланса
  const [balanceForm, setBalanceForm] = useState<'credit' | 'debit' | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceSuccess, setBalanceSuccess] = useState<string | null>(null);

  // Загрузка изображения
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  /**
   * Множество ID сообщений, отправленных самим админом через HTTP.
   * Когда WS эхо-дублирует эти сообщения, мы их пропускаем.
   */
  const sentMessageIdsRef = useRef(new Set<string>());

  /** Защита от двойного клика на «Отправить» — ref обновляется синхронно */
  const submittingRef = useRef(false);
  /** Защита от повторной загрузки изображения */
  const imageSubmittingRef = useRef(false);

  // Блокировка пользователя
  const [blockReason, setBlockReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blockSuccess, setBlockSuccess] = useState(false);

  // Прокрутка вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Внешний триггер форм (из заголовка дашборда)
  useEffect(() => {
    if (!externalAction) return;
    if (externalAction.type === 'block') { setShowBlockForm(true); setBlockError(null); }
    else if (externalAction.type === 'credit') { setBalanceForm('credit'); setBalanceSuccess(null); }
    else if (externalAction.type === 'debit') { setBalanceForm('debit'); setBalanceSuccess(null); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalAction?.key]);

  // Страховка поверх WebSocket: если сокет не авторизовался (например, истёк
  // access-токен) — переписка всё равно обновляется без перезагрузки страницы.
  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(() => {
      if (document.hidden) return;
      adminApi.tickets
        .messages(ticketId, { limit: 30 })
        .then((fresh) => {
          if (cancelled) return;
          setMessages((prev) => {
            const known = new Set(prev.map((m) => m.id));
            const added = fresh.filter((m) => !known.has(m.id));
            return added.length === 0 ? prev : [...prev, ...added];
          });
        })
        .catch(() => {
          /* молча — следующая попытка через интервал */
        });
    }, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ticketId]);

  // WebSocket: real-time подписка
  // Deps: только ticketId — статус управляется через onStatus, не нужно пересоздавать WS-листенеры
  useEffect(() => {
    const socket = getAdminSocket();

    const subscribe = () => socket.emit('subscribe:ticket', { ticketId });
    if (socket.connected) subscribe();
    // Всегда добавляем connect-слушатель — ловит reconnect
    socket.on('connect', subscribe);

    const onMessage = (m: AdminMessage & { ticketId: string }) => {
      if (m.ticketId !== ticketId) return;
      // Пропускаем WS-эхо собственных сообщений (они уже добавлены через HTTP-ответ)
      if (sentMessageIdsRef.current.has(m.id)) {
        sentMessageIdsRef.current.delete(m.id);
        return;
      }
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      const isUser = m.authorRole !== 'MODERATOR' && m.authorRole !== 'SUPER_ADMIN';
      if (isUser) playMessageSound();
      setIsTyping(false);
    };
    const onStatus = (s: { ticketId: string; status: TicketStatus }) => {
      if (s.ticketId !== ticketId) return;
      setStatus(s.status);
    };
    const onTyping = (data: { ticketId: string; isTyping: boolean }) => {
      if (data.ticketId !== ticketId) return;
      setIsTyping(data.isTyping);
      if (data.isTyping) {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setIsTyping(false), 4000);
      } else {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      }
    };

    socket.on('ticket:message', onMessage);
    socket.on('ticket:status', onStatus);
    socket.on('ticket:typing', onTyping);

    return () => {
      socket.emit('unsubscribe:ticket', { ticketId });
      socket.off('connect', subscribe);
      socket.off('ticket:message', onMessage);
      socket.off('ticket:status', onStatus);
      socket.off('ticket:typing', onTyping);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [ticketId]);

  // Эмитим typing при вводе
  const typingEmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleBodyChange = useCallback((value: string) => {
    setBody(value);
    const socket = getAdminSocket();
    if (socket.connected) {
      socket.emit('typing:ticket', { ticketId, isTyping: value.length > 0 });
      if (typingEmitTimerRef.current) clearTimeout(typingEmitTimerRef.current);
      if (value.length > 0) {
        typingEmitTimerRef.current = setTimeout(() => {
          socket.emit('typing:ticket', { ticketId, isTyping: false });
        }, 3000);
      }
    }
  }, [ticketId]);

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imageSubmittingRef.current) return;
    imageSubmittingRef.current = true;
    e.target.value = '';
    setImageUploading(true);
    setImageError(null);
    try {
      const msg = await adminApi.tickets.uploadImage(ticketId, file);
      sentMessageIdsRef.current.add(msg.id);
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
    } catch (err) {
      setImageError(err instanceof ApiException ? err.message : 'Ошибка загрузки изображения');
    } finally {
      setImageUploading(false);
      imageSubmittingRef.current = false;
    }
  }

  // Загрузить более старые сообщения
  async function loadMore() {    if (!cursorId) return;
    setLoadingMore(true);
    try {
      const prev = await adminApi.tickets.messages(ticketId, { beforeId: cursorId, limit: 30 });
      if (prev.length === 0 || prev.length < 30) setHasMore(false);
      if (prev.length > 0) {
        setCursorId(prev[0]?.id ?? cursorId);
        // Сохраняем скролл-позицию
        const list = listRef.current;
        const prevScrollHeight = list?.scrollHeight ?? 0;
        setMessages((m) => [...prev.filter(p => !m.some(x => x.id === p.id)), ...m]);
        requestAnimationFrame(() => {
          if (list) list.scrollTop = list.scrollHeight - prevScrollHeight;
        });
      }
    } finally {
      setLoadingMore(false);
    }
  }

  async function doSend() {
    if (submittingRef.current || body.trim().length < 1) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    const socket = getAdminSocket();
    if (socket.connected) socket.emit('typing:ticket', { ticketId, isTyping: false });
    try {
      const msg = await adminApi.tickets.send(ticketId, { body: body.trim() });
      sentMessageIdsRef.current.add(msg.id);
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      setBody('');
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Ошибка отправки');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    return doSend();
  }

  async function submitBalanceAdjust(e: FormEvent) {
    e.preventDefault();
    const azn = parseFloat(balanceAmount.replace(',', '.'));
    if (isNaN(azn) || azn <= 0) { setBalanceError('Введите корректную сумму'); return; }
    const minor = Math.round(azn * 100);
    const amountMinor = balanceForm === 'credit' ? String(minor) : String(-minor);
    setBalanceLoading(true);
    setBalanceError(null);
    setBalanceSuccess(null);
    try {
      const res = await adminApi.tickets.balanceAdjust(ticketId, {
        amountMinor,
        reason: balanceReason.trim() || (balanceForm === 'credit' ? 'Начисление' : 'Списание'),
      });
      const after = (Number(res.balanceAfterMinor) / 100).toFixed(2);
      setBalanceSuccess(`Готово. Баланс: ${after} AZN`);
      setBalanceAmount('');
      setBalanceReason('');
      setBalanceForm(null);
      onBalanceUpdated?.(res.balanceAfterMinor);
      const fresh = await adminApi.tickets.messages(ticketId, { limit: 30 });
      setMessages(fresh);
    } catch (e) {
      setBalanceError(e instanceof ApiException ? e.message : 'Ошибка корректировки');
    } finally {
      setBalanceLoading(false);
    }
  }

  async function submitBlock(e: FormEvent) {
    e.preventDefault();
    setBlockLoading(true);
    setBlockError(null);
    try {
      await adminApi.users.setStatus(userId, { status: 'BANNED', reason: blockReason.trim() || 'Заблокирован через тикет' });
      setBlockSuccess(true);
      setShowBlockForm(false);
    } catch (e) {
      setBlockError(e instanceof ApiException ? e.message : 'Ошибка блокировки');
    } finally {
      setBlockLoading(false);
    }
  }

  return (
    <div className={panelMode ? 'flex flex-col h-full' : 'flex flex-col gap-3'}>
      {/* Список сообщений */}
      <div ref={listRef} className={panelMode ? 'flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 pr-1' : 'space-y-3 max-h-[60vh] overflow-y-auto pr-1'}>
        {hasMore && (
          <div className="text-center py-1">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              {loadingMore ? 'Загрузка…' : '↑ Загрузить более старые'}
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-center text-sm text-ink-500 py-8">Сообщений нет</div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-page border border-border rounded-lg px-3 py-2 text-xs text-ink-400 italic flex items-center gap-1.5">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-ink-400 rounded-full animate-[typing_1s_ease-in-out_infinite]" />
                <span className="w-1.5 h-1.5 bg-ink-400 rounded-full animate-[typing_1s_ease-in-out_0.2s_infinite]" />
                <span className="w-1.5 h-1.5 bg-ink-400 rounded-full animate-[typing_1s_ease-in-out_0.4s_infinite]" />
              </span>
              Пользователь печатает...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={panelMode ? 'flex-shrink-0 border-t border-border px-4 pt-3 pb-4 space-y-2' : 'space-y-2'}>
      {balanceSuccess && (
        <div className="rounded-xl bg-success/10 border border-success/30 px-3 py-2 text-sm text-success">
          {balanceSuccess}
        </div>
      )}
      {blockSuccess && (
        <div className="rounded-xl bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger font-medium">
          Пользователь заблокирован.
        </div>
      )}

      {/* Форма блокировки */}
      {showBlockForm && (
        <form onSubmit={submitBlock} className="rounded-xl border border-danger/30 bg-danger/5 p-4 space-y-2">
          <div className="text-sm font-semibold text-danger">Заблокировать пользователя</div>
          <input
            type="text"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Причина блокировки (необязательно)"
            maxLength={500}
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/10"
          />
          {blockError && <div className="text-sm text-danger">{blockError}</div>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowBlockForm(false)} disabled={blockLoading}>Отмена</Button>
            <Button type="submit" variant="danger" size="sm" loading={blockLoading}>Заблокировать</Button>
          </div>
        </form>
      )}

      {/* Форма корректировки баланса */}
      {balanceForm && (
        <form onSubmit={submitBalanceAdjust} className="rounded-xl border border-border bg-elevated p-4 space-y-2">
          <div className="text-sm font-semibold text-ink-700">
            {balanceForm === 'credit' ? '＋ Начислить баланс' : '－ Списать баланс'}
          </div>
          <input
            type="number" min="0.01" step="0.01" value={balanceAmount}
            onChange={(e) => setBalanceAmount(e.target.value)}
            placeholder="Сумма в AZN" required
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
          <input
            type="text" value={balanceReason} maxLength={500}
            onChange={(e) => setBalanceReason(e.target.value)}
            placeholder="Причина (необязательно)"
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
          {balanceError && <div className="text-sm text-danger">{balanceError}</div>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setBalanceForm(null); setBalanceError(null); }} disabled={balanceLoading}>Отмена</Button>
            <Button type="submit" size="sm" loading={balanceLoading}>Подтвердить</Button>
          </div>
        </form>
      )}

      {status !== 'CLOSED' ? (
        <form onSubmit={send} className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleImageUpload}
          />
          <Textarea
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void doSend();
              }
            }}
            rows={panelMode ? 2 : 3}
            placeholder={panelMode ? 'Ответ… (Enter — отправить, Shift+Enter — новая строка)' : 'Ответ пользователю…'}
          />
          {error && <div className="text-sm text-danger">{error}</div>}
          {imageError && <div className="text-sm text-danger">{imageError}</div>}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button" variant="ghost" size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading}
                title="Прикрепить изображение"
              >
                {imageUploading ? '⏳' : '📎'} Изображение
              </Button>
              {!panelMode && (
                <>
                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => { setShowBlockForm(true); setBlockError(null); }}
                    disabled={loading || blockSuccess}
                    className="text-danger hover:text-danger"
                  >
                    🚫 Заблокировать
                  </Button>
                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => { setBalanceForm('credit'); setBalanceSuccess(null); }}
                    disabled={loading}
                    className="text-success hover:text-success"
                  >
                    ＋ Начислить
                  </Button>
                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => { setBalanceForm('debit'); setBalanceSuccess(null); }}
                    disabled={loading}
                    className="text-danger hover:text-danger"
                  >
                    － Списать
                  </Button>
                </>
              )}
            </div>
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
      </div>{/* end bottom section wrapper */}
    </div>
  );
}

function MessageBubble({ message }: { message: AdminMessage }) {
  const isStaff = message.authorRole === 'MODERATOR' || message.authorRole === 'SUPER_ADMIN';
  const isSystem = message.kind === 'SYSTEM' || message.kind === 'ACTION';

  if (isSystem) {
    return (
      <div className="text-center">
        <span className="inline-block text-xs px-3 py-1 bg-elevated text-ink-500 rounded-full border border-border">
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
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
          isStaff
            ? 'bg-primary text-white rounded-br-sm'
            : 'bg-elevated text-ink-900 border border-border rounded-bl-sm',
        )}
      >
        <div className={cn('text-xs mb-0.5', isStaff ? 'text-white/60' : 'text-ink-400')}>
          {message.authorUsername ?? 'Без автора'} · {formatDateTime(message.createdAt)}
        </div>
        {message.kind === 'FILE' ? (
          <a href={message.body} target="_blank" rel="noopener noreferrer">
            <img
              src={message.body}
              alt="Изображение"
              className="max-w-[280px] max-h-[280px] rounded-lg cursor-pointer object-contain"
            />
          </a>
        ) : (
          <div className="whitespace-pre-wrap break-words">{message.body}</div>
        )}
      </div>
    </div>
  );
}
