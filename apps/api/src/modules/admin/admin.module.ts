import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
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

@Module({
  imports: [AuthModule],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminCodePurchasesController,
    AdminWithdrawalsController,
    AdminTicketsController,
    AdminAuditController,
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
