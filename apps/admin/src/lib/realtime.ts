'use client';

import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Singleton-сокет для admin-панели. Аутентификация через httpOnly cookie chc_at. */
export function getAdminSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
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
