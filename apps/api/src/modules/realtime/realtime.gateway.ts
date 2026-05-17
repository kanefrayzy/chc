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

  /** Количество подключённых веб-клиентов (не из admin-панели). */
  private webClientCount = 0;

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
    if (!token) {
      // Гость с веб-сайта (не admin)
      this.webClientCount += 1;
      this.broadcastOnlineCount();
      return;
    }
    try {
      const payload = this.auth.verifyAccessToken(token);
      client.data.user = payload;
      await client.join(`user:${payload.sub}`);
      // Модераторы и админы подписываются на общую комнату тикетов
      if (payload.role === 'MODERATOR' || payload.role === 'SUPER_ADMIN') {
        await client.join('admin:tickets');
      } else {
        // Обычный юзер с веб-сайта
        this.webClientCount += 1;
        this.broadcastOnlineCount();
      }
    } catch {
      // невалидный токен — оставляем как гостя
      this.webClientCount += 1;
      this.broadcastOnlineCount();
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    const user = client.data.user;
    const isMod = user?.role === 'MODERATOR' || user?.role === 'SUPER_ADMIN';
    if (!isMod) {
      this.webClientCount = Math.max(0, this.webClientCount - 1);
      this.broadcastOnlineCount();
    }
    // socket.io сам убирает из комнат
  }

  /** Рассылает текущее количество онлайн-пользователей всем в комнате рулетки. */
  private broadcastOnlineCount(): void {
    this.server.to(ROULETTE_ROOM).emit('online:count', { count: this.webClientCount });
  }

  /** Возвращает текущее количество онлайн-пользователей. */
  getOnlineCount(): number {
    return this.webClientCount;
  }

  /** Клиент запрашивает текущее количество онлайн-пользователей. */
  @SubscribeMessage('get:online')
  getOnline(@ConnectedSocket() client: AuthedSocket): void {
    // Эмитируем напрямую клиенту, чтобы он подхватил через свой listener 'online:count'
    client.emit('online:count', { count: this.webClientCount });
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

  /** Клиент сообщает что печатает (или перестал) в тикете. */
  @SubscribeMessage('typing:ticket')
  async typingTicket(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { ticketId?: string; isTyping?: boolean },
  ): Promise<{ ok: boolean }> {
    const user = client.data.user;
    if (!user) return { ok: false };
    const id = body?.ticketId?.trim();
    if (!id) return { ok: false };
    // Рассылаем всем в комнате (кроме отправителя)
    client.to(`ticket:${id}`).emit('ticket:typing', {
      ticketId: id,
      userId: user.sub,
      username: null, // резолвится на клиенте
      isTyping: !!body.isTyping,
    });
    return { ok: true };
  }

  /** Новый тикет создан — уведомляем всех в комнате admin:tickets. */
  emitNewTicket(ticket: { id: string; userId: string; type: string; status: string; subject: string | null }): void {
    this.server.to('admin:tickets').emit('tickets:new', ticket);
  }

  /** Тикет обновлён (новое сообщение, смена статуса). */
  emitTicketUpdated(ticketId: string, data: { status?: string; lastMessagePreview?: string | null; lastMessageAt?: string | null }): void {
    this.server.to('admin:tickets').emit('tickets:updated', { ticketId, ...data });
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
