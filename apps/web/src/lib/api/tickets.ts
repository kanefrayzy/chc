import { apiFetch, getApiBaseUrl, ApiException } from './client';

export type TicketType = 'CODE_PURCHASE' | 'WITHDRAWAL' | 'SUPPORT';
export type TicketStatus = 'OPEN' | 'WAITING_USER' | 'WAITING_MODERATOR' | 'CLOSED';
export type MessageKind = 'TEXT' | 'FILE' | 'SYSTEM' | 'ACTION';

export interface TicketDto {
  id: string;
  type: TicketType;
  status: TicketStatus;
  subject: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
}

export interface MessageDto {
  id: string;
  ticketId: string;
  authorId: string | null;
  kind: MessageKind;
  body: string;
  createdAt: string;
  isMine: boolean;
}

export interface TicketsPageDto {
  items: TicketDto[];
  nextCursor: string | null;
}

export const ticketsApi = {
  list: (args: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (args.limit) params.set('limit', String(args.limit));
    if (args.cursor) params.set('cursor', args.cursor);
    const qs = params.toString();
    return apiFetch<TicketsPageDto>(`/tickets${qs ? `?${qs}` : ''}`, { credentials: 'include' });
  },
  get: (id: string) => apiFetch<TicketDto>(`/tickets/${id}`, { credentials: 'include' }),
  messages: (id: string, args: { afterId?: string; beforeId?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (args.afterId) params.set('afterId', args.afterId);
    if (args.beforeId) params.set('beforeId', args.beforeId);
    if (args.limit) params.set('limit', String(args.limit));
    const qs = params.toString();
    return apiFetch<{ items: MessageDto[] }>(
      `/tickets/${id}/messages${qs ? `?${qs}` : ''}`,
      { credentials: 'include' },
    );
  },
  sendMessage: (id: string, body: string) =>
    apiFetch<MessageDto>(`/tickets/${id}/messages`, {
      method: 'POST',
      body: { body },
      credentials: 'include',
    }),
  uploadImage: async (id: string, file: File): Promise<MessageDto> => {
    const url = `${getApiBaseUrl()}/tickets/${id}/upload-image`;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(url, {
      method: 'POST',
      body: form,
      credentials: 'include',
      cache: 'no-store',
    });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) throw new ApiException(res.status, data as null);
    return data as MessageDto;
  },
  create: (args: { subject: string; type?: string }) =>
    apiFetch<TicketDto>('/tickets', {
      method: 'POST',
      body: { subject: args.subject, type: args.type ?? 'SUPPORT' },
      credentials: 'include',
    }),
};
