import {
  Controller,
  Post,
  Param,
  Req,
  Headers,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import type { PaymentProvider as PaymentProviderEnum } from '@prisma/client';
import { DepositsService } from './deposits.service';
import { PaymentProviderRegistry } from '../payments/payments.module';

const ALLOWED: Record<string, PaymentProviderEnum> = {
  'betra-h2h': 'BETRA_H2H',
  westwallet: 'WESTWALLET',
};

/**
 * Endpoint: POST /webhooks/deposits/:provider
 * Принимает raw-тело (см. app.module.ts → urlencoded raw middleware),
 * проверяет подпись через провайдер и применяет финальный статус.
 */
@Controller('webhooks/deposits')
export class DepositsWebhookController {
  private readonly logger = new Logger(DepositsWebhookController.name);

  constructor(
    private readonly deposits: DepositsService,
    private readonly providers: PaymentProviderRegistry,
  ) {}

  @Post(':provider')
  async handle(
    @Param('provider') providerSlug: string,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ): Promise<{ ok: true; alreadyProcessed: boolean }> {
    const providerId = ALLOWED[providerSlug];
    if (!providerId) throw new BadRequestException(`Unknown provider: ${providerSlug}`);

    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!raw) throw new BadRequestException('Raw body missing');
    const rawBody = raw.toString('utf8');

    this.logger.log(`Webhook [${providerSlug}] body=${rawBody} headers=${JSON.stringify(headers)}`);

    const provider = this.providers.get(providerId);
    const parsed = provider.verifyAndParseWebhook(headers, rawBody);

    return this.deposits.applyWebhook({
      provider: providerId,
      externalId: parsed.externalId,
      status: parsed.status,
      rawPayload: parsed.rawPayload,
    });
  }
}
