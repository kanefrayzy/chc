import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { PaymentsModule } from '../payments/payments.module';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsWebhookController } from './withdrawals-webhook.controller';

@Module({
  imports: [AuthModule, PaymentMethodsModule, PaymentsModule],
  controllers: [WithdrawalsController, WithdrawalsWebhookController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
