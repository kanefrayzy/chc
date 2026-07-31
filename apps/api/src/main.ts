import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
    rawBody: true,
  });

  // Приложение всегда работает за nginx: без этого req.ip у всех запросов был бы
  // адресом прокси, и лимиты частоты применялись бы ко всем пользователям сразу.
  app.set('trust proxy', 1);

  app.use(helmet({
    // Позволяет загружать статику (/uploads/*) с других origin (Next.js app)
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cookieParser());
  app.enableCors({
    origin: [
      process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000',
      process.env.ADMIN_PUBLIC_URL ?? 'http://localhost:3001',
    ],
    credentials: true,
  });
  app.useGlobalPipes(new ZodValidationPipe());
  app.setGlobalPrefix('', { exclude: ['health', 'health/(.*)'] });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on http://0.0.0.0:${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  Logger.error(err, 'Bootstrap');
  process.exit(1);
});
