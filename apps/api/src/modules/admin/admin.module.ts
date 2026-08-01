import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RanksModule } from '../ranks/ranks.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';
import { AdminAuditService } from './admin-audit.service';
import { AdminUsersService } from './admin-users.service';
import { AdminCodePurchasesService } from './admin-code-purchases.service';
import { AdminWithdrawalsService } from './admin-withdrawals.service';
import { AdminTicketsService } from './admin-tickets.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminCodePurchasesController } from './admin-code-purchases.controller';
import { AdminWithdrawalsController } from './admin-withdrawals.controller';
import { AdminTicketsController } from './admin-tickets.controller';
import { AdminAuditController } from './admin-audit.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminRanksController } from './admin-ranks.controller';
import { AdminPaymentMethodsController } from './admin-payment-methods.controller';
import { AdminRouletteController } from './admin-roulette.controller';
import { AdminMinesController } from './admin-mines.controller';
import { AdminTranslationsController } from './admin-translations.controller';
import { AdminExchangeRatesController } from './admin-exchange-rates.controller';

@Module({
  imports: [AuthModule, RanksModule, PaymentMethodsModule, WithdrawalsModule],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminCodePurchasesController,
    AdminWithdrawalsController,
    AdminTicketsController,
    AdminAuditController,
    AdminSettingsController,
    AdminRanksController,
    AdminPaymentMethodsController,
    AdminRouletteController,
    AdminMinesController,
    AdminTranslationsController,
    AdminExchangeRatesController,
  ],
  providers: [
    AdminAuditService,
    AdminUsersService,
    AdminCodePurchasesService,
    AdminWithdrawalsService,
    AdminTicketsService,
  ],
})
export class AdminModule {}
