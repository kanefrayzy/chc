'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@chcgreen/ui';
import { useUi } from './ui-context';
import { ChatIcon, CloseIcon, SendIcon } from '@/components/icons';
import { ticketsApi, type TicketDto, type MessageDto } from '@/lib/api/tickets';
import { useTicketSocket, type TicketMessageEvent } from '@/lib/realtime/useTicketSocket';
import { playMessageSound } from '@/lib/sounds';

export interface ChatWidgetProps {
  viewerId: string | null;
}

export function ChatWidget({ viewerId }: ChatWidgetProps): JSX.Element {
  const tChat = useTranslations('chat');
  const { chatOpen, toggleChat, closeChat } = useUi();
  const [tickets, setTickets] = useState<TicketDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOpenRef = useRef(false);

  // Закрываем виджет нажатием Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape' && chatOpen) closeChat(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatOpen, closeChat]);

  // Загружаем тикеты при первом открытии
  useEffect(() => {
    if (!chatOpen || !viewerId) return;
    isOpenRef.current = true;
    ticketsApi.list({ limit: 10 }).then((res) => {
      setTickets(res.items);
      if (!activeId && res.items[0]) setActiveId(res.items[0].id);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen, viewerId]);

  // Загружаем сообщения при смене активного тикета
  useEffect(() => {
    if (!activeId || !viewerId) return;
    ticketsApi.messages(activeId, { limit: 50 }).then((res) => {
      setMessages(res.items);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 0);
    }).catch(() => {});
  }, [activeId, viewerId]);

  // WebSocket — новые сообщения в реальном времени
  useTicketSocket(activeId, {
    onMessage: (event: TicketMessageEvent) => {
      const isStaff =
        event.authorRole === 'MODERATOR' || event.authorRole === 'SUPER_ADMIN';
      const msg: MessageDto = {
        id: event.id,
        ticketId: event.ticketId,
        body: event.body,
        kind: event.kind,
        authorId: event.authorId,
        isMine: !isStaff,
        createdAt: event.createdAt,
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (isStaff) {
        playMessageSound();
      }
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    },
  });

  const handleSend = async (): Promise<void> => {
    if (!input.trim() || !activeId || sending) return;
    setSending(true);
    const body = input.trim();
    setInput('');
    try {
      await ticketsApi.sendMessage(activeId, body);
      // WS принесёт сообщение обратно; на случай если нет — добавляем optimistically
    } catch {
      setInput(body); // вернуть если ошибка
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = (): void => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = ''; // сброс — чтобы повторно выбрать тот же файл
    if (!file || !activeId) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Только изображения');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Файл слишком большой (макс. 5 МБ)');
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const msg = await ticketsApi.uploadImage(activeId, file);
      // WS принесёт эхо; добавляем сразу с дедупликацией по id
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch {
      setUploadError('Не удалось загрузить изображение');
    } finally {
      setUploading(false);
    }
  };

  const createTicket = async (): Promise<void> => {
    try {
      const tk = await ticketsApi.create({ subject: 'Поддержка' });
      setActiveId(tk.id);
      setTickets((prev) => [tk, ...prev]);
    } catch { /* */ }
  };

  return (
    <>
      {/* Кнопка-триггер */}
      <button
        onClick={toggleChat}
        className={cn(
          'fixed bottom-20 right-4 z-40 lg:bottom-6 lg:right-6',
          'h-12 w-12 rounded-full shadow-xl transition-all',
          'flex items-center justify-center',
          chatOpen
            ? 'bg-danger text-white shadow-danger/40'
            : 'bg-brand text-black shadow-brand/40 hover:scale-110',
        )}
        style={{ boxShadow: chatOpen ? '0 4px 20px rgba(255,59,92,0.5)' : '0 4px 20px rgba(0,255,136,0.4)' }}
        aria-label={chatOpen ? 'Закрыть чат' : 'Открыть чат'}
        aria-expanded={chatOpen}
      >
        {chatOpen ? <CloseIcon className="h-5 w-5" /> : <ChatIcon className="h-5 w-5" />}
      </button>

      {/* Панель чата */}
      <div
        className={cn(
          'fixed z-40 transition-all duration-300',
          'bottom-36 right-4 lg:bottom-20 lg:right-6',
          'w-80 sm:w-96',
          chatOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none',
        )}
      >
        <div className="flex flex-col rounded-2xl border border-border bg-bg-card shadow-2xl overflow-hidden"
          style={{ height: 480, maxHeight: '70vh' }}>
          {/* Заголовок */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-elevated">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
              <span className="text-sm font-semibold text-text-primary">{tChat('title')}</span>
            </div>
            <button
              onClick={closeChat}
              aria-label="Свернуть"
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-card hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          {!viewerId ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-text-muted">
              {tChat('loginPrompt')}
            </div>
          ) : (
            <>
              {/* Список тикетов (если несколько) */}
              {tickets.length > 1 && (
                <div className="flex gap-1 overflow-x-auto px-3 py-2 border-b border-border/40">
                  {tickets.map((tk) => (
                    <button
                      key={tk.id}
                      onClick={() => { setActiveId(tk.id); setMessages([]); }}
                      className={cn(
                        'shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition',
                        tk.id === activeId
                          ? 'bg-brand text-black'
                          : 'bg-bg-elevated text-text-muted hover:text-text-primary border border-border',
                      )}
                    >
                      #{tk.id.slice(-4)}
                    </button>
                  ))}
                </div>
              )}

              {/* Сообщения */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 && tickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <ChatIcon className="h-10 w-10 text-text-muted opacity-60" />
                    <p className="text-sm text-text-muted">Нет активных обращений</p>
                    <button
                      onClick={createTicket}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
                    >
                      Начать чат
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-sm text-text-muted">
                    Написать первое сообщение…
                  </div>
                ) : (
                  messages.map((m) => {
                    const isOwn = m.isMine;
                    return (
                      <div key={m.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                        <div
                          className={cn(
                            'rounded-xl px-3 py-2 max-w-[80%] text-sm',
                            isOwn
                              ? 'bg-brand text-black rounded-br-sm'
                              : 'bg-bg-elevated text-text-primary border border-border rounded-bl-sm',
                          )}
                        >
                          {m.kind === 'FILE' ? (
                            <a href={m.body} target="_blank" rel="noopener noreferrer">
                              <img
                                src={m.body}
                                alt="Изображение"
                                className="max-w-[200px] max-h-[200px] rounded-lg cursor-pointer object-contain"
                              />
                            </a>
                          ) : (
                            <span className="whitespace-pre-wrap break-words">{m.body}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Ввод */}
              {(activeId || tickets.length > 0) && (
                <div className="border-t border-border">
                  {uploadError && (
                    <div className="px-3 pt-2 text-xs text-danger">{uploadError}</div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => void handleImageChange(e)}
                    />
                    <button
                      onClick={handlePickImage}
                      disabled={uploading || !activeId}
                      aria-label="Прикрепить изображение"
                      title="Прикрепить изображение"
                      className="h-8 w-8 shrink-0 rounded-lg border border-border bg-bg-elevated text-text-muted flex items-center justify-center transition-colors hover:text-text-primary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      {uploading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      )}
                    </button>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                      placeholder="Написать…"
                      className="flex-1 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
                    />
                    <button
                      onClick={() => void handleSend()}
                      disabled={sending || !input.trim()}
                      aria-label="Отправить"
                      className="h-8 w-8 shrink-0 rounded-lg bg-brand text-black flex items-center justify-center disabled:opacity-40 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      <SendIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
