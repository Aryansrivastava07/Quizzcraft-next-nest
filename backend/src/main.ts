import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { validationPipe } from './common/pipes/validation.pipe';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const env = process.env.NODE_ENV || 'development';
  console.log(`[Server] Bootstrapping QuizzCraft Backend in ${env} mode...`);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust reverse proxies (Render, Vercel, Railway, Cloudflare, etc.) so that secure cookies and forwarded headers work properly
  app.set('trust proxy', 1);

  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like curl, postman, server-to-server health pings)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-refresh-token',
      'x-reset-pass-token',
      'x-access-token',
      'x-requested-with',
      'Accept',
      'Origin',
    ],
    exposedHeaders: [
      'Set-Cookie',
      'Authorization',
      'x-refresh-token',
      'x-reset-pass-token',
      'x-access-token',
    ],
  });

  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '10mb' });
  app.use(cookieParser());

  app.useGlobalPipes(new validationPipe());

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = process.env.PORT ?? 5000;
  await app.listen(port, '0.0.0.0');
  console.log(`[Server] QuizzCraft Backend online and listening at http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error('[Fatal Bootstrap Error] Failed to start backend application:', err);
  process.exit(1);
});
