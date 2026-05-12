import { apiFetch } from './client';

export interface WalletBalanceDto {
  balanceMinor: string;
  totalWageredMinor: string;
}

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'BET_PLACE'
  | 'BET_WIN'
  | 'BET_REFUND'
  | 'CODE_HOLD'
  | 'CODE_RELEASE'
  | 'CODE_REFUND'
  | 'REFERRAL_EARNING'
  | 'ADMIN_ADJUSTMENT'
  | 'CASE_OPEN'
  | 'CASE_WIN'
  | 'JACKPOT_BET'
  | 'JACKPOT_WIN'
  | 'JACKPOT_COMMISSION';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'REVERSED' | 'FAILED';

export interface TransactionDto {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amountMinor: string;
  balanceAfterMinor: string;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface TransactionsPageDto {
  items: TransactionDto[];
  nextCursor: string | null;
}

export interface ListTransactionsArgs {
  limit?: number;
  cursor?: string;
  type?: TransactionType;
}

function buildQuery(args: ListTransactionsArgs): string {
  const params = new URLSearchParams();
  if (args.limit != null) params.set('limit', String(args.limit));
  if (args.cursor) params.set('cursor', args.cursor);
  if (args.type) params.set('type', args.type);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const walletApi = {
  balance: (): Promise<WalletBalanceDto> => apiFetch('/wallet/balance'),
  transactions: (args: ListTransactionsArgs = {}): Promise<TransactionsPageDto> =>
    apiFetch(`/wallet/transactions${buildQuery(args)}`),
};
