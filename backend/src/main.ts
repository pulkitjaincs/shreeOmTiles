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
  app.enableCors({
    origin: true, // Reflects request origin, allowed with credentials
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
