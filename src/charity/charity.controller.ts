import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestWithAuth } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import * as sharp from 'sharp';
import { S3Service } from '../s3/s3.service';
import { VoteChoice } from '../../generated/prisma';
import { TonApiClient } from '@ton-api/client';
import { VOTING_EXP } from '../constants/config';

type ProcessedImage = {
  originalUrl: string;
  thumbUrl: string;
  original_size: [number, number];
  thumb_size: [number, number];
};

async function processImageToBuffers(
  fileStream: NodeJS.ReadableStream,
): Promise<{
  original: { buffer: Buffer; info: sharp.OutputInfo; mime: string; ext: string };
  thumb: { buffer: Buffer; info: sharp.OutputInfo; mime: string; ext: string };
}> {
  const base = sharp().rotate();

  const originalPromise = base
    .clone()
    .resize({
      width: 1024,
      height: 600,
      fit: 'cover',
      position: 'center',
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen({ sigma: 0.4 })
    .withMetadata()
    .webp({ quality: 85, smartSubsample: true, effort: 6 })
    .toBuffer({ resolveWithObject: true });

  const thumbPromise = base
    .clone()
    .resize({
      width: 400,
      height: 240,
      fit: 'cover',
      position: 'center',
      kernel: sharp.kernel.lanczos3,
      fastShrinkOnLoad: false,
    })
    .sharpen({ sigma: 0.4 })
    .withMetadata()
    .webp({ quality: 85, smartSubsample: true, effort: 6 })
    .toBuffer({ resolveWithObject: true });


  fileStream.pipe(base);

  const [orig, th] = await Promise.all([originalPromise, thumbPromise]);

  return {
    original: { buffer: orig.data, info: orig.info, mime: 'image/webp', ext: '.webp' },
    thumb: { buffer: th.data, info: th.info, mime: 'image/webp', ext: '.webp' }
  };
}

@Controller()
export class CharityController {
  constructor(
    private readonly prisma: PrismaService, 
    private readonly s3: S3Service,
    @Inject("TONAPI_CLIENT") private readonly tonapi: TonApiClient
  ) { }

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
    const images: ProcessedImage[] = [];

    for await (const part of parts) {
      if (part.type === 'file') {
        // const filename = `${Date.now()}-${randomUUID()}${extname(part.filename)}`;
        // const absolutePath = join('/var/www/grouche/uploads', filename);
        // await pipeline(part.file, createWriteStream(absolutePath));

        const processed = await processImageToBuffers(part.file);

        // грузим обе версии в S3
        const [originalUrl, thumbUrl] = await Promise.all([
          this.s3.uploadBuffer(
            processed.original.buffer,
            processed.original.mime,
            'charities/originals',
            processed.original.ext,
          ),
          this.s3.uploadBuffer(
            processed.thumb.buffer,
            processed.thumb.mime,
            'charities/thumbs',
            processed.thumb.ext,
          ),
        ]);

        images.push({
          originalUrl,
          thumbUrl,
          original_size: [processed.original.info.width!, processed.original.info.height!],
          thumb_size: [processed.thumb.info.width!, processed.thumb.info.height!],
        });
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
          images,
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
      where: { id, status: "accepted" },
      include: { history: true },
    });

    if (!charity) throw new NotFoundException('Charity not found');

    return charity;
  }

  @Get('charities/in-review')
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findInReviewRecent(
    @Query('search') search?: string,
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
  ) {
    const since = new Date(Date.now() - VOTING_EXP);

    const charities = await this.prisma.charity.findMany({
      where: {
        status: 'in_review',
        created_at: { gte: since },
        ...(search && {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        }),
      },
      skip: offset,
      take: limit,
      orderBy: { created_at: 'desc' },
    });

    return charities;
  }

  @Get('charity/in-review/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getCharityReview(@Param('id') id: number) {
    const since = new Date(Date.now() - VOTING_EXP);

    const charity = await this.prisma.charity.findUnique({
      where: { id, status: "in_review", created_at: { gte: since }},
      include: { history: true },
    });

    if (!charity) throw new NotFoundException('Charity not found');

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
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
  ) {
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
      skip: offset,
      take: limit,
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
      if (charity.status !== 'accepted') {
        await tx.user.update({
          where: { wallet: req.address },
          data: {
            limit: { increment: charity.donation_needed },
          },
        });
      }

      await tx.charity.delete({
        where: { id },
      });
    });

    return { message: 'Charity deleted and funds returned to user' };
  }

  @Post('charity/:id/vote')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({
    schema: {
      type: 'object',
      properties: { choice: { type: 'string', enum: ['yes', 'no'] } },
      required: ['choice'],
    },
  })
  async vote(
    @Param('id') id: number,
    @Req() req: RequestWithAuth,
    @Body('choice') choice: VoteChoice,
  ) {
    if (choice !== 'yes' && choice !== 'no') {
      throw new BadRequestException('choice must be "yes" or "no"');
    }

    const charity = await this.prisma.charity.findUnique({ where: { id } });
    if (!charity) throw new NotFoundException('Charity not found');

    if (charity.status !== 'in_review') {
      throw new BadRequestException('Voting is allowed only while charity is in_review');
    }

    const expireDate = new Date(charity.created_at.getTime() + VOTING_EXP);
    if (new Date() > expireDate) {
      throw new BadRequestException('Voting period has expired');
    }

    // const balance = await this.tonapi.accounts.getAccountJettonBalance(Address.parse(req.address), Address.parse("EQAu7qxfVgMg0tpnosBpARYOG--W1EUuX_5H_vOQtTVuHnrn"))

    const result = await this.prisma.$transaction(async (tx) => {
      const prev = await tx.vote.findUnique({
        where: { charityId_userWallet: { charityId: charity.id, userWallet: req.address } },
      });

      if (!prev) {
        await tx.vote.create({
          data: { charityId: charity.id, userWallet: req.address, choice },
        });
        await tx.charity.update({
          where: { id: charity.id },
          data: choice === 'yes' ? { votes_yes: { increment: 1 } } : { votes_no: { increment: 1 } },
        });
        return { changed: true, action: 'created', choice };
      }

      if (prev.choice === choice) {
        return { changed: false, action: 'noop', choice };
      }

      await tx.vote.update({
        where: { charityId_userWallet: { charityId: charity.id, userWallet: req.address } },
        data: { choice },
      });
      await tx.charity.update({
        where: { id: charity.id },
        data:
          choice === 'yes'
            ? { votes_yes: { increment: 1 }, votes_no: { decrement: 1 } }
            : { votes_no: { increment: 1 }, votes_yes: { decrement: 1 } },
      });

      return { changed: true, action: 'switched', choice };
    });

    return { message: 'Vote processed', ...result };
  }

}
