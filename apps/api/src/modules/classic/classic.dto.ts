import { IsString, Matches } from 'class-validator';

export class PlaceClassicBetDto {
  /** Сумма ставки в qəpik (как строка для безопасной передачи BigInt). */
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/, { message: 'amountMinor must be a positive integer string' })
  amountMinor!: string;
}
