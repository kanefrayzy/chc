'use client';

import { io, type Socket } from 'socket.io-client';
import { getApiBaseUrl } from './api/client';

let socket: Socket | null = null;

/** Singleton-сокет для admin-панели. Аутентификация через httpOnly cookie chc_at. */
export function getAdminSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.connect();
    return socket;
  }
  const url = getApiBaseUrl();
  socket = io(url, {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  return socket;
}
