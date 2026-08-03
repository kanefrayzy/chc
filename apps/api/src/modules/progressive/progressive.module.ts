import { Global, Module } from '@nestjs/common';
import { ProgressiveService } from './progressive.service';
import { ProgressiveController } from './progressive.controller';

/**
 * Глобальный: отчисления в копилки делают все игровые модули,
 * поэтому сервис должен быть доступен без явного импорта.
 */
@Global()
@Module({
  providers: [ProgressiveService],
  controllers: [ProgressiveController],
  exports: [ProgressiveService],
})
export class ProgressiveModule {}
