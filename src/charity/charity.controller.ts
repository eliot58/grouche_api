import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestWithAuth } from '../auth/auth.types';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery } from '@nestjs/swagger';

@Controller()
export class CharityController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('charity')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Charity creation payload',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        contact: { type: 'string' },
        deadline: { type: 'string', format: 'date-time' },
        amount: { type: 'string' },
        image1: {
          type: 'string',
          format: 'binary',
        },
        image2: {
          type: 'string',
          format: 'binary',
        },
        image3: {
          type: 'string',
          format: 'binary',
        },
        image4: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['title', 'description', 'contact', 'deadline', 'amount'],
    },
  })
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: RequestWithAuth) {
    const parts = req.parts();
    const dto: Record<string, any> = {};
    const imagePaths: string[] = [];

    for await (const part of parts) {
      if (part.type === 'file') {
        const filename = `${Date.now()}-${randomUUID()}${extname(part.filename)}`;
        const absolutePath = join('/var/www/grouche/uploads', filename);
        await pipeline(part.file, createWriteStream(absolutePath));
        imagePaths.push(`/uploads/${filename}`);
      } else {
        dto[part.fieldname] = part.value;
      }
    }

    const amount = parseInt(dto.amount, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { wallet: req.address } });

      if (!user || user.limit < amount) {
        throw new BadRequestException('Not enough limit');
      }

      await tx.user.update({
        where: { wallet: req.address },
        data: {
          limit: { decrement: amount },
          initiativesCreated: { increment: 1 },
        },
      });

      const charity = await tx.charity.create({
        data: {
          title: dto.title,
          description: dto.description,
          images: imagePaths,
          deadline: new Date(dto.deadline),
          donation_needed: amount,
          contact: dto.contact,
          author: {
            connect: { wallet: req.address },
          },
        },
      });

      return charity;
    });

    return result;
  }

  @Get('charity/:id')
  async getCharity(@Param('id') id: number) {
    const charity = await this.prisma.charity.findUnique({
      where: { id },
      include: { history: true },
    });

    if (!charity) {
      throw new NotFoundException('Charity not found');
    }

    return charity;
  }

  @Get('charities')
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
  })
  async findAll(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = limit ? parseInt(limit, 10) : 8;
    const skip = offset ? parseInt(offset, 10) : 0;

    const charities = await this.prisma.charity.findMany({
      where: {
        status: 'accepted',
        ...(search && {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        }),
      },
      skip,
      take,
      orderBy: {
        created_at: 'desc',
      },
    });

    return charities;
  }

  @Delete('charity/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async deleteCharity(@Param('id') id: number, @Req() req: RequestWithAuth) {
    const charity = await this.prisma.charity.findUnique({
      where: { id },
    });

    if (!charity) {
      throw new NotFoundException('Charity not found');
    }

    if (charity.authorWallet !== req.address) {
      throw new ForbiddenException('You are not the author of this charity');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { wallet: req.address },
        data: {
          limit: { increment: charity.donation_needed },
        },
      });

      await tx.charity.delete({
        where: { id },
      });
    });

    return { message: 'Charity deleted and funds returned to user' };
  }
}
