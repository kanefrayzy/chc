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
  ],
  controllers: [HealthController],
})
export class AppModule {}
