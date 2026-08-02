import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { DepositsService } from './deposits.service';
import { DepositsController } from './deposits.controller';
import { DepositsWebhookController } from './deposits-webhook.controller';

@Module({
  imports: [AuthModule, PaymentsModule, PaymentMethodsModule, RealtimeModule, ReferralsModule],
  controllers: [DepositsController, DepositsWebhookController],
  providers: [DepositsService],
  exports: [DepositsService],
})
export class DepositsModule {}
