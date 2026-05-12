import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService, type AccessTokenPayload } from '../auth/auth.service';
import { AUTH_COOKIE } from '../auth/auth.config';
import { PrismaService } from '../../common/prisma/prisma.module';

const ROULETTE_ROOM = 'roulette';

interface AuthedSocket extends Socket {
  data: { user?: AccessTokenPayload };
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const parts = header.split(';');
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx < 0) continue;
    const k = p.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(p.slice(idx + 1).trim());
  }
  return undefined;
}

@WebSocketGateway({
  path: '/socket.io',
  cors: {
    origin: [
      process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000',
      process.env.ADMIN_PUBLIC_URL ?? 'http://localhost:3001',
    ],
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthedSocket): Promise<void> {
    // Все клиенты (включая гостей) попадают в общую комнату рулетки —
    // round state доступен анонимно.
    await client.join(ROULETTE_ROOM);

    const token =
      parseCookie(client.handshake.headers.cookie, AUTH_COOKIE.access) ??
      (client.handshake.auth?.token as string | undefined);
    if (!token) return;
    try {
      const payload = this.auth.verifyAccessToken(token);
      client.data.user = payload;
      await client.join(`user:${payload.sub}`);
    } catch {
      // невалидный токен — оставляем как гостя
    }
  }

  handleDisconnect(_client: AuthedSocket): void {
    // socket.io сам убирает из комнат
  }

  /** Клиент запрашивает подписку на конкретный тикет. */
  @SubscribeMessage('subscribe:ticket')
  async subscribeTicket(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { ticketId?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const user = client.data.user;
    if (!user) return { ok: false, error: 'UNAUTHORIZED' };
    const id = body?.ticketId?.trim();
    if (!id) return { ok: false, error: 'BAD_REQUEST' };
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!ticket) return { ok: false, error: 'NOT_FOUND' };
    const isOwner = ticket.userId === user.sub;
    const isMod = user.role === 'MODERATOR' || user.role === 'SUPER_ADMIN';
    if (!isOwner && !isMod) return { ok: false, error: 'FORBIDDEN' };
    await client.join(`ticket:${id}`);
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe:ticket')
  async unsubscribeTicket(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { ticketId?: string },
  ): Promise<{ ok: boolean }> {
    const id = body?.ticketId?.trim();
    if (!id) return { ok: false };
    await client.leave(`ticket:${id}`);
    return { ok: true };
  }

  // ─── Хелперы для эмита из сервисов ──────────────────────────────────────
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToTicket(ticketId: string, event: string, payload: unknown): void {
    this.server.to(`ticket:${ticketId}`).emit(event, payload);
  }

  emitRoulette(event: string, payload: unknown): void {
    this.server.to(ROULETTE_ROOM).emit(event, payload);
  }
}
