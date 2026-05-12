'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@chcgreen/ui';
import { useUi } from './ui-context';
import { ticketsApi, type TicketDto, type MessageDto } from '@/lib/api/tickets';

const POLL_MS = 6000;

export interface ChatWidgetProps {
  viewerId: string | null;
}

export function ChatWidget({ viewerId }: ChatWidgetProps): JSX.Element {
  const { chatOpen, toggleChat, closeChat } = useUi();
  const [tickets, setTickets] = useState<TicketDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Закрываем виджет нажатием Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape' && chatOpen) closeChat(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatOpen, closeChat]);

  // Polling тикетов
  useEffect(() => {
    if (!chatOpen || !viewerId) return;
    let cancelled = false;
    const pull = async (): Promise<void> => {
      try {
        const res = await ticketsApi.list({ limit: 10 });
        if (cancelled) return;
        setTickets(res.items);
        if (!activeId && res.items[0]) setActiveId(res.items[0].id);
      } catch { /* */ } finally {
        if (!cancelled) timerRef.current = setTimeout(pull, POLL_MS);
      }
    };
    pull();
    return () => { cancelled = true; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [chatOpen, viewerId, activeId]);

  // Polling сообщений активного тикета
  useEffect(() => {
    if (!chatOpen || !activeId || !viewerId) return;
    let cancelled = false;
    const pullMsgs = async (): Promise<void> => {
      try {
        const res = await ticketsApi.messages(activeId, { limit: 50 });
        if (cancelled) return;
        setMessages(res.items);
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      } catch { /* */ }
    };
    const id = setInterval(pullMsgs, 4000);
    pullMsgs();
    return () => { cancelled = true; clearInterval(id); };
  }, [chatOpen, activeId, viewerId]);

  const handleSend = async (): Promise<void> => {
    if (!input.trim() || !activeId || sending) return;
    setSending(true);
    try {
      await ticketsApi.sendMessage(activeId, input.trim());
      setInput('');
      const res = await ticketsApi.messages(activeId, { limit: 50 });
      setMessages(res.items);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch { /* */ } finally {
      setSending(false);
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
          'flex items-center justify-center text-xl',
          chatOpen
            ? 'bg-danger text-white rotate-45 shadow-danger/40'
            : 'bg-brand text-black shadow-brand/40 hover:scale-110',
        )}
        style={{ boxShadow: chatOpen ? '0 4px 20px rgba(255,59,92,0.5)' : '0 4px 20px rgba(0,255,136,0.4)' }}
        aria-label="Открыть чат"
      >
        {chatOpen ? '✕' : '💬'}
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
              <span className="text-sm font-semibold text-text-primary">Поддержка</span>
            </div>
            <button onClick={closeChat} className="text-text-muted hover:text-text-primary text-xs px-1">✕</button>
          </div>

          {!viewerId ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-text-muted">
              Войдите, чтобы написать в поддержку
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
                    <span className="text-3xl">💬</span>
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
                          {m.body}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Ввод */}
              {(activeId || tickets.length > 0) && (
                <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
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
                    className="h-8 w-8 rounded-lg bg-brand text-black flex items-center justify-center text-sm disabled:opacity-40 hover:brightness-110"
                  >
                    ➤
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
