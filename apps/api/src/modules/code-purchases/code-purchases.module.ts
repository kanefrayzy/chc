import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CodePurchasesService } from './code-purchases.service';
import { CodePurchasesController } from './code-purchases.controller';

@Module({
  imports: [AuthModule],
  controllers: [CodePurchasesController],
  providers: [CodePurchasesService],
  exports: [CodePurchasesService],
})
export class CodePurchasesModule {}
