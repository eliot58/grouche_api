import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TonApiClient } from '@ton-api/client';
import { Address } from '@ton/core';
import { Cron } from '@nestjs/schedule';
import { GRC_MASTER } from '../constants/config';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject("TONAPI_CLIENT") private readonly tonapi: TonApiClient
  ) { }

  private async getJettonBalanceOrZero(userAddr: string, jettonMinterAddr: string): Promise<bigint> {
    try {
      const res = await this.tonapi.accounts.getAccountJettonBalance(
        Address.parse(userAddr),
        Address.parse(jettonMinterAddr),
      );
      return res.balance;
    } catch (e: any) {
      const status = e?.status ?? e?.response?.status;
      const msg: string = e?.message ?? e?.response?.data?.error ?? '';
      if (status === 404 || /has no jetton wallet/i.test(msg)) {
        return 0n;
      }
      throw e;
    }
  }

  async getUsers() {
    const users = await this.prisma.user.findMany();

    return users;
  }

  async getUser(address: string) {
    const user = await this.prisma.user.findUnique({
      where: { wallet: address },
      select: {
        totalDonated: true,
        initiativesCreated: true,
        initiativesSupported: true,
        votesParticipated: true,
        limit: true
      }
    });

    if (!user) throw new NotFoundException('User not found');

    const balance = await this.getJettonBalanceOrZero(address, GRC_MASTER);

    return {
      ...user,
      balance: balance.toString()
    };
  }

  async getOtherUser(address: string) {
    const user = await this.prisma.user.findUnique({
      where: { wallet: address },
      select: {
        totalDonated: true,
        initiativesCreated: true,
        initiativesSupported: true,
        votesParticipated: true
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const balance = await this.getJettonBalanceOrZero(address, GRC_MASTER);

    return { ...user, balance: balance.toString() };
  }

  async getUserCharities(address: string, limit: number, offset: number) {
    const charities = await this.prisma.charity.findMany({
      where: {
        authorWallet: address,
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: offset,
      take: limit,
    });

    return charities;
  }

  async getInventory(address: string, limit: number, offset: number) {
    return await this.prisma.nftItems.findMany({
      where: { sender: address },
      skip: offset,
      take: limit,
    });
  }

  async getDonatations(address: string, limit: number, offset: number) {
    const donations = await this.prisma.donationHistory.findMany({
      where: { userWallet: address },
      include: { charity: true },
      skip: offset,
      take: limit,
    });

    return donations;
  }

  @Cron('0 0 */4 * * *')
  async checkBurnAll() {
    this.logger.log('Starting scheduled NFT burn check...');
    const uncheckedItems = await this.prisma.nftItems.findMany({
      where: { is_checked: false },
    });

    const burnRecipient = Address.parse(
      'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
    ).toString({ bounceable: true });

    for (const nftItem of uncheckedItems) {
      try {
        const bounceNftAddress = Address.parse(nftItem.address).toString({
          bounceable: true,
        });
        this.logger.log(`Checking NFT item ${bounceNftAddress}`);

        const history = await this.tonapi.nft.getNftHistoryById(
          Address.parse(nftItem.address),
          { limit: 10 },
          {},
        );
        const eventId = history.events?.[0]?.eventId;
        if (!eventId) {
          this.logger.warn(
            `No NFT events found for ${bounceNftAddress}, skipping`,
          );
          continue;
        }

        const event = await this.tonapi.events.getEvent(eventId);
        const action = event.actions[0]?.NftItemTransfer;
        if (!action) {
          this.logger.warn(
            `NftItemTransfer action not found in event for ${bounceNftAddress}, skipping`,
          );
          continue;
        }

        const sender = action.sender?.address.toString({ bounceable: true });
        const recipient = action.recipient?.address.toString({
          bounceable: true,
        });

        if (recipient !== burnRecipient) {
          this.logger.log(
            `NFT ${bounceNftAddress} recipient is not burn address, skipping`,
          );
          continue;
        }

        let user = await this.prisma.user.findUnique({
          where: { wallet: sender },
        });
        if (!user) {
          this.logger.log(`User ${sender} not found, creating new user`);
          user = await this.prisma.user.create({
            data: { wallet: sender!, limit: 0 },
          });
        }

        const match = nftItem.content.match(/^(\d+)\.json$/);
        const pointsToAdd = match ? parseInt(match[1], 10) : 0;
        if (pointsToAdd <= 0) {
          this.logger.warn(
            `Invalid NFT content format or zero points for ${bounceNftAddress}, skipping`,
          );
          continue;
        }

        await this.prisma.$transaction([
          this.prisma.user.update({
            where: { wallet: sender },
            data: { limit: { increment: pointsToAdd } },
          }),
          this.prisma.nftItems.update({
            where: { address: bounceNftAddress },
            data: { is_checked: true, sender: sender },
          }),
        ]);

        this.logger.log(
          `Added ${pointsToAdd} points to user ${sender} for NFT ${bounceNftAddress}`,
        );
      } catch (error) {
        this.logger.error(
          `Error processing NFT item ${nftItem.address}: ${error.message}`,
          error.stack,
        );
      }
    }

    this.logger.log('Scheduled NFT burn check completed.');
  }
}
