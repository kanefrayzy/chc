import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const BalanceAdjustSchema = z.object({
  amountMinor: z.string().regex(/^-?\d+$/),
  reason: z.string().trim().min(3).max(500),
});
export class BalanceAdjustDto extends createZodDto(BalanceAdjustSchema) {}

export const UserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'BANNED', 'MUTED']),
  reason: z.string().trim().min(3).max(500).optional(),
});
export class UserStatusDto extends createZodDto(UserStatusSchema) {}

export const IssueCodeSchema = z.object({
  code: z.string().trim().min(1).max(200),
});
export class IssueCodeDto extends createZodDto(IssueCodeSchema) {}

export const RejectReasonSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export class RejectReasonDto extends createZodDto(RejectReasonSchema) {}

export const TicketMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
export class TicketMessageDto extends createZodDto(TicketMessageSchema) {}

export const ApproveWithdrawalSchema = z.object({
  externalId: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});
export class ApproveWithdrawalDto extends createZodDto(ApproveWithdrawalSchema) {}
