import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { REFUND_GRACE_PERIOD_MS } from '../constants/config';

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);
    
    constructor(
        private readonly prisma: PrismaService
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async refundRejectedCharities() {
        this.logger.log('Refund job started');

        const sevenDaysAgo = new Date(Date.now() - REFUND_GRACE_PERIOD_MS);

        const toRefund = await this.prisma.charity.findMany({
            where: {
                status: 'rejected',
                rejectedDate: { lte: sevenDaysAgo }
            },
            select: {
                authorWallet: true,
                donation_needed: true
            },
        });

        if (toRefund.length === 0) {
            this.logger.log('Nothing to refund');
            return;
        }

        this.logger.log(`Found ${toRefund.length} charities to refund`);

        for (const ch of toRefund) {
            await this.prisma.user.update({
                where: { wallet: ch.authorWallet },
                data: {
                    limit: { increment: ch.donation_needed }
                }
            })
        }

        this.logger.log('Refund job finished');
    }
}
