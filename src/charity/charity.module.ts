import { Module } from '@nestjs/common';
import { CharityController } from './charity.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CharityController]
})
export class CharityModule {}
