import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { FastifyCorsOptions } from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
import './instrument';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      ignoreTrailingSlash: true,
      bodyLimit: 200 * 1024 * 1024,
    }),
  );

  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 200 * 1024 * 1024,
    },
  });
  app.register(fastifyCookie);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const corsOptions: FastifyCorsOptions = {
    origin: [
      'https://grouche.com',
      'https://testnet.grouche.com',
      'https://miniapp.grouche.com',
      'https://dev.grouche.com',
      'http://dev.grouche.com:3000',
      'http://0.0.0.0:3000',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://0.0.0.0:8000',
      'http://localhost:8000',
      'http://127.0.0.1:8000',
      'null',
    ],
    credentials: true,
    methods: '*',
    allowedHeaders: ['*', 'Authorization', 'Content-Type'],
  };

  app.enableCors(corsOptions);

  const config = new DocumentBuilder()
    .setTitle('Grouche API')
    .setDescription('The Grouche API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);

  await app.listen(3000, '0.0.0.0');
}

bootstrap();
