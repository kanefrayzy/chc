'use client';

import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Singleton-сокет. Cookie с access-токеном пробрасывается автоматически
 * благодаря `withCredentials`. Используем websocket-only, чтобы не плодить
 * long-polling запросы.
 */
export function getRealtimeSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    // не подключён — попробуем переподключить
    socket.connect();
    return socket;
  }
  // Используем origin (без /api), чтобы namespace был '/' (дефолтный)
  const url = window.location.origin;
  socket = io(url, {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  return socket;
}

export function disconnectRealtimeSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
