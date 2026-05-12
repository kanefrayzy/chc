import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { CodePurchasesModule } from './modules/code-purchases/code-purchases.module';
import { RouletteModule } from './modules/roulette/roulette.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { RanksModule } from './modules/ranks/ranks.module';
import { AdminModule } from './modules/admin/admin.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    TerminusModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    WalletModule,
    PaymentsModule,
    DepositsModule,
    WithdrawalsModule,
    TicketsModule,
    CodePurchasesModule,
    RouletteModule,
    ReferralsModule,
    RanksModule,
    SettingsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
