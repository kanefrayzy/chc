'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Spinner, Badge } from '@chcgreen/ui';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { ticketsApi, type MessageDto, type TicketDto } from '@/lib/api/tickets';
import { useTicketSocket } from '@/lib/realtime/useTicketSocket';
import { getRealtimeSocket } from '@/lib/realtime/socket';
import { playMessageSound } from '@/lib/sounds';

export interface ChatThreadProps {
  ticket: TicketDto;
  viewerId: string;
  locale: string;
}

const PAGE_SIZE = 30;

export function ChatThread({ ticket, viewerId, locale }: ChatThreadProps): JSX.Element {
  const t = useTranslations('chat');

  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [status, setStatus] = useState(ticket.status);
  const [isTyping, setIsTyping] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  /** Курсор пагинации — ref, чтобы не триггерить re-render */
  const oldestIdRef = useRef<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** ID сообщений, отправленных юзером через HTTP — чтобы пропустить WS-эхо */
  const sentIdsRef = useRef(new Set<string>());

  // ── Первичная загрузка ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    setMessages([]);
    setHasMore(false);
    oldestIdRef.current = null;
    setStatus(ticket.status); // синхронизируем при смене тикета

    ticketsApi
      .messages(ticket.id, { limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setMessages(res.items);
        setHasMore(res.items.length >= PAGE_SIZE);
        oldestIdRef.current = res.items[0]?.id ?? null;
      })
      .catch(() => {/* silent */})
      .finally(() => { if (!cancelled) setInitialLoading(false); });

    return () => { cancelled = true; };
    // Только ticket.id — НЕ ticket.status (статус управляется WS-событием)
  }, [ticket.id]);

  // ── Авто-прокрутка вниз ────────────────────────────────────────────────────
  const isFirstLoadRef = useRef(true);

  // При смене тикета сбрасываем флаг
  useEffect(() => {
    isFirstLoadRef.current = true;
  }, [ticket.id]);

  useEffect(() => {
    if (initialLoading || !scrollRef.current) return;
    if (isFirstLoadRef.current) {
      // Начальная загрузка — мгновенный скролл в конец
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      isFirstLoadRef.current = false;
    } else {
      // Новое сообщение — плавный скролл
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages.length, initialLoading]);

  // ── Cleanup таймеров ───────────────────────────────────────────────────────
  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  }, []);

  // ── Load more ──────────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!oldestIdRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await ticketsApi.messages(ticket.id, {
        limit: PAGE_SIZE,
        beforeId: oldestIdRef.current,
      });
      if (res.items.length < PAGE_SIZE) setHasMore(false);
      if (res.items.length > 0) {
        oldestIdRef.current = res.items[0]?.id ?? oldestIdRef.current;
        const el = scrollRef.current;
        const prevH = el?.scrollHeight ?? 0;
        setMessages((m) => [
          ...res.items.filter((p) => !m.some((x) => x.id === p.id)),
          ...m,
        ]);
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevH;
        });
      }
    } catch {/* silent */} finally {
      setLoadingMore(false);
    }
  }, [ticket.id, loadingMore]);

  // ── Typing emit ────────────────────────────────────────────────────────────
  const handleTypingChange = useCallback((typing: boolean) => {
    try {
      getRealtimeSocket().emit('typing:ticket', { ticketId: ticket.id, isTyping: typing });
    } catch {/* silent */}
  }, [ticket.id]);

  // ── Отправить сообщение ────────────────────────────────────────────────────
  const handleSend = useCallback(async (body: string): Promise<void> => {
    setSendError(null);
    try {
      const msg = await ticketsApi.sendMessage(ticket.id, body);
      // Регистрируем ДО setMessages — WS-эхо приходит почти одновременно
      sentIdsRef.current.add(msg.id);
      setMessages((prev) => prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setSendError(text);
      if (text.includes('TICKET_CLOSED') || text.includes('CLOSED')) setStatus('CLOSED');
    }
  }, [ticket.id]);

  // ── Загрузить изображение ──────────────────────────────────────────────────
  const handleUploadImage = useCallback(async (file: File): Promise<void> => {
    setSendError(null);
    const msg = await ticketsApi.uploadImage(ticket.id, file);
    // Регистрируем ДО setMessages — WS-эхо приходит почти одновременно
    sentIdsRef.current.add(msg.id);
    setMessages((prev) => prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]);
  }, [ticket.id]);

  // ── WS-события ────────────────────────────────────────────────────────────
  useTicketSocket(ticket.id, {
    onMessage: (m) => {
      // Пропускаем WS-эхо собственных сообщений
      if (sentIdsRef.current.has(m.id)) {
        sentIdsRef.current.delete(m.id);
        return;
      }
      const dto: MessageDto = {
        id: m.id,
        ticketId: m.ticketId,
        authorId: m.authorId,
        kind: m.kind,
        body: m.body,
        createdAt: m.createdAt,
        isMine: m.authorId === viewerId,
      };
      setMessages((prev) => prev.some((x) => x.id === dto.id) ? prev : [...prev, dto]);
      if (!dto.isMine) {
        playMessageSound();
        // Сбрасываем "печатает…" когда пришло сообщение
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        setIsTyping(false);
      }
    },
    onStatus: (s) => setStatus(s.status),
    onTyping: (data) => {
      if (data.userId === viewerId) return;
      setIsTyping(data.isTyping);
      if (data.isTyping) {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setIsTyping(false), 4000);
      } else {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      }
    },
  });

  return (
    <Card variant="elevated" padding="none" className="flex h-[600px] flex-col">
      <CardHeader className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-xs text-text-muted">{t(`type.${ticket.type}`)}</div>
          <div className="text-base font-semibold text-text-primary">
            {ticket.subject ?? t(`type.${ticket.type}`)}
          </div>
        </div>
        <Badge variant="info">{t(`status.${status}`)}</Badge>
      </CardHeader>

      <CardBody className="flex-1 overflow-hidden p-0">
        <div
          ref={scrollRef}
          className="flex h-full flex-col overflow-y-auto px-4 py-3 gap-1.5"
        >
          {hasMore && (
            <div className="py-1 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {loadingMore ? '...' : t('thread.loadMore', { defaultMessage: 'Загрузить ещё' })}
              </button>
            </div>
          )}
          {initialLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
              {t('thread.empty')}
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} locale={locale} />)
          )}
          {isTyping && (
            <div className="flex items-center gap-1.5 px-1 text-xs italic text-text-muted">
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
              </span>
              {t('thread.typing', { defaultMessage: 'Поддержка печатает...' })}
            </div>
          )}

        </div>
      </CardBody>

      {sendError && (
        <div className="px-4 pb-1 text-xs text-danger">{sendError}</div>
      )}
      <MessageComposer
        onSend={handleSend}
        onUploadImage={handleUploadImage}
        disabled={status === 'CLOSED'}
        onTypingChange={handleTypingChange}
      />
    </Card>
  );
}
