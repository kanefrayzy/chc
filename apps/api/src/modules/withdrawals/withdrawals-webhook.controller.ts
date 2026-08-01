import { Controller, Post, Param, Req, BadRequestException, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { WithdrawalsService } from './withdrawals.service';
import { BetatransferProvider } from '../payments/betatransfer.provider';

/**
 * Endpoint: POST /webhooks/withdrawals/:provider
 * Колбэк о статусе выплаты. Подпись проверяется провайдером,
 * при отмене выплаты средства возвращаются игроку.
 */
@Controller('webhooks/withdrawals')
export class WithdrawalsWebhookController {
  private readonly logger = new Logger(WithdrawalsWebhookController.name);

  constructor(
    private readonly withdrawals: WithdrawalsService,
    private readonly betatransfer: BetatransferProvider,
  ) {}

  @Post(':provider')
  async handle(
    @Param('provider') providerSlug: string,
    @Req() req: Request,
  ): Promise<{ ok: true; alreadyProcessed: boolean }> {
    if (providerSlug !== 'betatransfer') {
      throw new BadRequestException(`Unknown provider: ${providerSlug}`);
    }

    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!raw) throw new BadRequestException('Raw body missing');

    const parsed = this.betatransfer.verifyPayoutWebhook(raw.toString('utf8'));
    this.logger.log(
      `Payout webhook [${providerSlug}] withdrawal=${parsed.withdrawalId} → ${parsed.status}`,
    );

    return this.withdrawals.applyPayoutWebhook(parsed);
  }
}
