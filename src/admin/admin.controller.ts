import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AdminGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
export class AdminController {
    constructor(
        private readonly prisma: PrismaService
    ) { }

    @Get('charities')
    @ApiBearerAuth()
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number
    })
    @ApiQuery({
        name: 'offset',
        required: false,
        type: Number
    })
    @UseGuards(AdminGuard)
    async findAll(
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        const take = limit ? parseInt(limit, 10) : 8;
        const skip = offset ? parseInt(offset, 10) : 0;

        const charities = await this.prisma.charity.findMany({
            where: {
                status: 'in_review'
            },
            skip,
            take,
            orderBy: {
                created_at: 'desc',
            },
        });

        return charities.map((charity) => ({
            ...charity,
            donation_needed: charity.donation_needed.toString(),
            donation_collected: charity.donation_collected.toString(),
        }));
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
        @Body() body: { status: 'accepted' | 'rejected', address?: string }
    ) {
        const { status, address } = body;

        const charity = await this.prisma.charity.findUnique({
            where: { id: Number(id) },
        });

        if (!charity) {
            throw new NotFoundException('Charity not found');
        }

        if (charity.status !== 'in_review') {
            throw new BadRequestException('Charity is already processed');
        }

        if (status === 'accepted') {
            if (!address) {
                throw new BadRequestException('Address is required for accepted charities');
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
                    data: { status: 'rejected' },
                });

                await tx.user.update({
                    where: { wallet: charity.authorWallet },
                    data: {
                        limit: { increment: charity.donation_needed }
                    },
                });
            });
        } else {
            throw new BadRequestException('Invalid status');
        }

        return { message: `Charity has been ${status}` };

    }
}
