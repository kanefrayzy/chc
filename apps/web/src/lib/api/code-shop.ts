import { apiFetch } from './client';

export interface CodeProductDto {
  id: string;
  name: string;
  denominationMinor: string;
  priceMinor: string;
  description: string | null;
  stock: number;
}

export interface PurchasedCodeDto {
  id: string;
  code: string;
  productName: string;
  denominationMinor: string;
  priceMinor: string;
  soldAt: string | null;
}

export const codeShopApi = {
  products: (cookieHeader?: string) =>
    apiFetch<{ items: CodeProductDto[] }>('/code-shop/products', {
      ...(cookieHeader ? { headers: { cookie: cookieHeader } } : {}),
    }),

  buy: (productId: string) =>
    apiFetch<{ code: PurchasedCodeDto; balanceMinor: string }>('/code-shop/buy', {
      method: 'POST',
      body: { productId },
    }),

  history: (params: { limit?: number; cursor?: string; cookieHeader?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', params.cursor);
    const qs = q.toString();
    return apiFetch<{ items: PurchasedCodeDto[]; nextCursor: string | null }>(
      `/code-shop/history${qs ? `?${qs}` : ''}`,
      { ...(params.cookieHeader ? { headers: { cookie: params.cookieHeader } } : {}) },
    );
  },
};
