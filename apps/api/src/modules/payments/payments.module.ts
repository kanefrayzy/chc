import { Injectable, BadRequestException, Module } from '@nestjs/common';
import type { PaymentProvider as PaymentProviderEnum } from '@prisma/client';
import { BetatransferProvider } from './betatransfer.provider';
import { WestWalletProvider } from './west-wallet.provider';
import type { PaymentProvider } from './payment-provider.interface';

@Injectable()
export class PaymentProviderRegistry {
  private readonly map: Map<PaymentProviderEnum, PaymentProvider>;

  constructor(betatransfer: BetatransferProvider, west: WestWalletProvider) {
    this.map = new Map<PaymentProviderEnum, PaymentProvider>([
      [betatransfer.id, betatransfer],
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
  providers: [BetatransferProvider, WestWalletProvider, PaymentProviderRegistry],
  exports: [PaymentProviderRegistry],
})
export class PaymentsModule {}
