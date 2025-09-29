import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AdminGuard } from '../auth/jwt-auth.guard';
import { VOTING_EXP } from '../constants/config';

@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) { }

  @Get('charities')
  @ApiBearerAuth()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @UseGuards(AdminGuard)
  async findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = limit ? parseInt(limit, 10) : 8;
    const skip = offset ? parseInt(offset, 10) : 0;

    const cutoff = new Date(Date.now() - VOTING_EXP);

    const charities = await this.prisma.charity.findMany({
      where: {
        status: 'in_review',
        created_at: { lte: cutoff },
      },
      skip,
      take,
      orderBy: { created_at: 'desc' },
    });

    return charities;
  }


  @Patch('charity/:id')
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['accepted', 'rejected'],
          example: 'accepted',
        },
        address: {
          type: 'string',
          example: 'EQC2vRkWqU7....YourContractAddress',
          nullable: true,
        },
      },
      required: ['status'],
    },
  })
  @UseGuards(AdminGuard)
  async updateCharityStatus(
    @Param('id') id: number,
    @Body() body: { status: 'accepted' | 'rejected'; address?: string },
  ) {
    const { status, address } = body;

    const charity = await this.prisma.charity.findUnique({
      where: { id },
    });

    if (!charity) {
      throw new NotFoundException('Charity not found');
    }

    if (charity.status !== 'in_review') {
      throw new BadRequestException('Charity is already processed');
    }

    if (status === 'accepted') {
      if (!address) {
        throw new BadRequestException(
          'Address is required for accepted charities',
        );
      }

      await this.prisma.charity.update({
        where: { id },
        data: {
          status: 'accepted',
          address,
        },
      });
    } else if (status === 'rejected') {
      await this.prisma.$transaction(async (tx) => {
        await tx.charity.update({
          where: { id },
          data: { status: 'rejected', rejectedDate: new Date() },
        });
      });
    } else {
      throw new BadRequestException('Invalid status');
    }

    return { message: `Charity has been ${status}` };
  }
}
