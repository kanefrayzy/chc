import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import * as path from 'path';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PaymentMethodsModule } from './modules/payment-methods/payment-methods.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { CodePurchasesModule } from './modules/code-purchases/code-purchases.module';
import { RouletteModule } from './modules/roulette/roulette.module';
import { MinesModule } from './modules/mines/mines.module';
import { ClassicModule } from './modules/classic/classic.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { RanksModule } from './modules/ranks/ranks.module';
import { AdminModule } from './modules/admin/admin.module';
import { SettingsModule } from './modules/settings/settings.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ProgressiveModule } from './modules/progressive/progressive.module';
import { WinnersModule } from './modules/winners/winners.module';
import { CodeShopModule } from './modules/code-shop/code-shop.module';
import { LotteryModule } from './modules/lottery/lottery.module';
import { InternalAwareThrottlerGuard } from './common/internal-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    // Базовый лимит на все запросы; на чувствительных ручках (логин, регистрация,
    // ставки, заявки) он ужесточён декоратором @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    ServeStaticModule.forRoot({
      rootPath: path.join('/app', 'uploads'),
      serveRoot: '/uploads',
    }),
    TerminusModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    WalletModule,
    PaymentsModule,
    PaymentMethodsModule,
    DepositsModule,
    WithdrawalsModule,
    TicketsModule,
    CodePurchasesModule,
    RouletteModule,
    MinesModule,
    ClassicModule,
    ReferralsModule,
    RanksModule,
    SettingsModule,
    RealtimeModule,
    ProgressiveModule,
    WinnersModule,
    CodeShopModule,
    LotteryModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: InternalAwareThrottlerGuard }],
})
export class AppModule {}
