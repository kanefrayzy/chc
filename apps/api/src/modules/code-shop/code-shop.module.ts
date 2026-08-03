import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CodeShopService } from './code-shop.service';
import { CodeShopController } from './code-shop.controller';
import { CodeShopAdminController } from './code-shop.admin.controller';

@Module({
  imports: [AuthModule],
  providers: [CodeShopService],
  controllers: [CodeShopController, CodeShopAdminController],
  exports: [CodeShopService],
})
export class CodeShopModule {}
