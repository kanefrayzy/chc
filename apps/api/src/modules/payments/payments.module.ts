import { Injectable, BadRequestException, Module } from '@nestjs/common';
import type { PaymentProvider as PaymentProviderEnum } from '@prisma/client';
import { BetraH2HProvider } from './betra-h2h.provider';
import { WestWalletProvider } from './west-wallet.provider';
import type { PaymentProvider } from './payment-provider.interface';

@Injectable()
export class PaymentProviderRegistry {
  private readonly map: Map<PaymentProviderEnum, PaymentProvider>;

  constructor(betra: BetraH2HProvider, west: WestWalletProvider) {
    this.map = new Map<PaymentProviderEnum, PaymentProvider>([
      [betra.id, betra],
      [west.id, west],
    ]);
  }

  get(id: PaymentProviderEnum): PaymentProvider {
    const provider = this.map.get(id);
    if (!provider) throw new BadRequestException(`Unknown payment provider: ${id}`);
    return provider;
  }
}

@Module({
  providers: [BetraH2HProvider, WestWalletProvider, PaymentProviderRegistry],
  exports: [PaymentProviderRegistry],
})
export class PaymentsModule {}
