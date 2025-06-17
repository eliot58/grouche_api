import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { TonApiClient } from '@ton-api/client';
import { Address } from "@ton/core";

@Injectable()
export class UserService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService
    ) { }

    async getUser(address: string) {
        return this.prisma.user.findUnique({ where: { wallet: address } })
    }

    async checkBurn(address: string, nft_address: string) {
        const user = await this.prisma.user.findUnique({ where: { wallet: address } });
        if (!user) throw new NotFoundException("User not found");

        const userAddressStr = Address.parse(address).toString({ bounceable: true });
        const bounceNftAddress = Address.parse(nft_address).toString({ bounceable: true });

        const nftItem = await this.prisma.nftItems.findUnique({ where: { address: bounceNftAddress } });
        if (!nftItem) throw new NotFoundException("Item not found");

        if (nftItem.is_checked) throw new ForbiddenException("Already checked");

        const tonApiKey = this.configService.get<string>('TONAPIKEY');
        if (!tonApiKey) throw new InternalServerErrorException('TONAPIKEY is not defined');

        const client = new TonApiClient({ baseUrl: 'https://tonapi.io', apiKey: tonApiKey });

        const history = await client.nft.getNftHistoryById(Address.parse(nft_address), { limit: 10 }, {});
        const eventId = history.events?.[0]?.eventId;
        if (!eventId) throw new BadRequestException('No NFT events found');

        const event = await client.events.getEvent(eventId);
        const action = event.actions[0]?.NftItemTransfer;
        if (!action) throw new BadRequestException('NftItemTransfer action not found in event');

        const sender = action.sender?.address.toString({ bounceable: true });
        const recipient = action.recipient?.address.toString({ bounceable: true });

        const burnRecipient = Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c').toString({ bounceable: true });

        if (sender !== userAddressStr || recipient !== burnRecipient) {
            throw new BadRequestException('NFT transfer does not match burn criteria.');
        }

        const match = nftItem.content.match(/^(\d+)\.json$/);
        const pointsToAdd = match ? parseInt(match[1], 10) : 0;

        if (pointsToAdd <= 0) {
            throw new BadRequestException('Invalid NFT content format or zero points');
        }

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { wallet: address },
                data: {
                    points: { increment: pointsToAdd }
                }
            }),
            this.prisma.nftItems.update({
                where: { address: bounceNftAddress },
                data: { is_checked: true }
            })
        ]);
    }


}
