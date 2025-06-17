import { BadRequestException, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { RequestWithAuth } from 'src/auth/auth.types';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class CompanyController {
    constructor(
        private readonly prisma: PrismaService
    ) { }

    @Post('company')
    @UseGuards(JwtAuthGuard)
    async create(@Req() req: RequestWithAuth) {
        const user = await this.prisma.user.findUnique({ where: { wallet: req.address } });

        if (!user || user.points < 1) {
            throw new BadRequestException('Not enough points');
        }

        await this.prisma.user.update({
            where: { wallet: req.address },
            data: { points: { decrement: 1 } },
        });

        const parts = req.parts();
        const dto: Record<string, any> = {};
        let filePath = '';

        for await (const part of parts) {
            if (part.type === 'file') {
                const filename = `${Date.now()}-${randomUUID()}${extname(part.filename)}`;
                const absolutePath = join('/var/www/grouche/uploads', filename);

                await pipeline(part.file, createWriteStream(absolutePath));

                filePath = `/uploads/${filename}`;
            } else {
                dto[part.fieldname] = part.value;
            }
        }

        const company = await this.prisma.company.create({
            data: {
                title: dto.title,
                description: dto.description,
                image: filePath,
                expired_at: new Date(dto.expired_at),
                total_amount: BigInt(dto.total_amount),
            }
        });

        return {
            ...company,
            total_amount: company.total_amount.toString()
        };
    }


    @Get('companies')
    async findAll() {
        const companies = await this.prisma.company.findMany();

        return companies.map((company) => ({
            ...company,
            total_amount: company.total_amount?.toString(),
        }));
    }
}
