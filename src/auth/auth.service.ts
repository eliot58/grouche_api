import { JwtService } from '@nestjs/jwt';
import { AuthToken, PayloadToken } from './jwt.interface';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CHAIN } from '@tonconnect/ui-react';
import { TonProofService } from '../services/ton-proof-service';
import { sha256 } from "@ton/crypto";
import { CheckProofRequest } from './dto/check-proof-dto';
import { TonApiService } from '../services/ton-api-service';

@Injectable()
export class AuthService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService
    ) { }

    public async generateToken(payload: AuthToken | PayloadToken, expirationTime: string): Promise<string> {
        return await this.jwtService.signAsync(payload, {
            expiresIn: expirationTime,
        });
    }

    public async generateAuthToken(address: string, network: CHAIN): Promise<string> {
        const payload: AuthToken = { address, network };
        return this.generateToken(payload, '1y');
    }

    public async generatePayloadToken(randomBytes: string): Promise<string> {
        const payload: PayloadToken = { randomBytes };
        return this.generateToken(payload, '15m');
    }


    public async verifyToken(token: string) {
        try {
            const payload = await this.jwtService.verifyAsync(token);
            return payload;
        } catch (error) {
            return null;
        }
    }

    public async generatePayload() {
        const service = new TonProofService();

        const randomBytes = await service.generateRandomBytes();
        const payloadToken = await this.generatePayloadToken(randomBytes.toString('hex'));
        const payloadTokenHash = (await sha256(payloadToken)).toString('hex');

        return {
            payloadToken: payloadToken,
            payloadTokenHash: payloadTokenHash,
        };
    }


    public async checkProof(data: any) {
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        const body = CheckProofRequest.parse(parsedData);

        const client = TonApiService.create(body.network);
        const service = new TonProofService();

        const isValid = await service.checkProof(body, (address) => client.getWalletPublicKey(address));
        if (!isValid) {
            throw new BadRequestException('Invalid proof');
        }

        const payloadTokenHash = body.proof.payload;
        const payloadToken = body.payloadToken;
        
        if (!await this.verifyToken(payloadToken)) {
            throw new BadRequestException('Invalid token');
        }

        if ((await sha256(payloadToken)).toString('hex') !== payloadTokenHash) {
            throw new BadRequestException('Invalid payload token hash');
        }

        let user = await this.prisma.user.findUnique({
            where: { wallet: body.address }
        })

        if (!user) {
            user = await this.prisma.user.create({
                data: { wallet: body.address },
            });
        }

        const token = await this.generateAuthToken(body.address, body.network);

        return { token };
    }
}
