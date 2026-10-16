import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable HTTP response compression (gzip / brotli) to save bandwidth and lower mobile latency
  app.use(compression({ threshold: 512, level: 6 }));

  // Gracefully handle container shutdowns (e.g. Render / Koyeb restarts)
  app.enableShutdownHooks();

  // Enable CORS for Web Dashboard & Mobile App clients
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const defaultAllowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://shree-om-tiles.vercel.app',
  ];
  const envOrigins = allowedOriginsEnv
    ? allowedOriginsEnv
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];
  const configuredOrigins = Array.from(
    new Set([...defaultAllowedOrigins, ...envOrigins]),
  );

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      if (
        configuredOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production' ||
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(
          origin,
        ) ||
        /^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Normalize multiple leading slashes in incoming requests (e.g. //auth/login -> /auth/login)
  app.use((req: { url?: string }, _res: unknown, next: () => void) => {
    if (req.url && req.url.startsWith('//')) {
      req.url = req.url.replace(/^\/+/, '/');
    }
    next();
  });

  // Enable Global Validation with automatic payload transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(
    `🚀 Shree Om Tiles Backend API is running on: http://localhost:${port}`,
  );
}
void bootstrap();
