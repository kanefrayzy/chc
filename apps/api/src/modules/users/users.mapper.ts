import { type User } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';

export interface PublicUserDto {
  id: string;
  username: string;
  email: string | null;
  language: string;
  role: User['role'];
  balanceMinor: string;
  referralCode: string;
  avatarUrl: string | null;
  createdAt: string;
}

export function toPublicUser(user: User): PublicUserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    language: user.language,
    role: user.role,
    balanceMinor: minorToJson(user.balanceMinor),
    referralCode: user.referralCode,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
