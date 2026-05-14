export interface PublicUser {
  id: string;
  username: string;
  email: string;
  language: 'ru' | 'az';
  role: 'USER' | 'MODERATOR' | 'SUPER_ADMIN';
  balanceMinor: string; // bigint as string
  rankSlug?: string;
  referralCode: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
}
