import { Module } from '@nestjs/common';
import { CharityController } from './charity.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [PrismaModule, S3Module],
  controllers: [CharityController],
})
export class CharityModule {}
