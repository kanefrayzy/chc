import { apiFetch } from './client';

export type CodePurchaseStatus =
  | 'CREATED'
  | 'AWAITING_MODERATOR'
  | 'CODE_ISSUED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CodePurchaseDto {
  id: string;
  status: CodePurchaseStatus;
  amountMinor: string;
  ticketId: string | null;
  code: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CodePurchasesPageDto {
  items: CodePurchaseDto[];
  nextCursor: string | null;
}

export interface CreateCodePurchaseRequest {
  comment?: string;
}

export const codePurchasesApi = {
  create: (req: CreateCodePurchaseRequest) =>
    apiFetch<CodePurchaseDto>('/code-purchases', {
      method: 'POST',
      body: req,
      credentials: 'include',
    }),
  list: (args: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (args.limit) params.set('limit', String(args.limit));
    if (args.cursor) params.set('cursor', args.cursor);
    const qs = params.toString();
    return apiFetch<CodePurchasesPageDto>(`/code-purchases${qs ? `?${qs}` : ''}`, {
      credentials: 'include',
    });
  },
  cancel: (id: string) =>
    apiFetch<CodePurchaseDto>(`/code-purchases/${id}/cancel`, {
      method: 'POST',
      credentials: 'include',
    }),
};
