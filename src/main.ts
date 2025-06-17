import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { FastifyCorsOptions } from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      ignoreTrailingSlash: true,
      bodyLimit: 200 * 1024 * 1024
    }),
  );

  await app.register(fastifyMultipart);

  await app.register(fastifyStatic, {
    root: '/var/www/grouche/uploads',
    prefix: '/uploads/',
});

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true
  }));

  const corsOptions: FastifyCorsOptions = {
    origin: [
      'https://grouche.com',
      'http://0.0.0.0:3000',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://0.0.0.0:8000',
      'http://localhost:8000',
      'http://127.0.0.1:8000',
      'null'
    ],
    credentials: true,
    methods: '*',
    allowedHeaders: ['*', 'Authorization', 'Content-Type']
  };

  app.enableCors(corsOptions);

  await app.listen(3000, '0.0.0.0');
}
bootstrap();
