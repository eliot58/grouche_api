import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './jwt.interface';
import { ACCESS_TOKEN_EXPIRE_MINUTES } from '../constants/config';
import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nacl from 'tweetnacl';
import { Address } from "@ton/core";
import { CheckProofPayload } from '../auth/wallet.dto';
import * as crypto from 'crypto';
import { DOMAIN, PAYLOAD_TTL, PROOF_TTL } from '../constants/config';
import { TonApiClient } from '@ton-api/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService
    ) { }

    public async generateAccessToken(address: string): Promise<string> {
        const payload: JwtPayload = { sub: address };
        return await this.jwtService.signAsync(payload, {
            expiresIn: ACCESS_TOKEN_EXPIRE_MINUTES,
        });
    }

    public async validateToken(token: string) {
        try {
            const payload = await this.jwtService.verifyAsync(token);

            return { valid: true, ...payload };
        } catch (error) {
            return { valid: false, error: 'Invalid or expired token' };
        }
    }

    public generatePayload() {
        const randomBits = crypto.randomBytes(8);

        const currentTime = Math.floor(Date.now() / 1000);
        const expirationTime = Buffer.alloc(8);
        expirationTime.writeBigUint64BE(BigInt(currentTime + PAYLOAD_TTL));
        const payload = Buffer.concat([randomBits, expirationTime]);

        const sharedSecret = this.configService.get<string>('SECRET');
        if (!sharedSecret) {
            throw new InternalServerErrorException('SECRET is not defined in the environment variables');
        }

        const hmac = crypto.createHmac("sha256", sharedSecret);
        hmac.update(payload);
        const signature = hmac.digest();

        const finalPayload = Buffer.concat([payload, signature]);

        const payloadHex = finalPayload.subarray(0, 32).toString("hex");

        return { payload: payloadHex }
    }


    public async connect(wallet: any) {

        const { proof, address, network } = CheckProofPayload.parse(wallet);
        const payload = Buffer.from(proof.payload, "hex");

        if (payload.length !== 32) {
            throw new BadRequestException(`Invalid payload length, got ${payload.length}, expected 32`);
        }

        const sharedSecret = this.configService.get<string>('SECRET');
        if (!sharedSecret) {
            throw new InternalServerErrorException('SECRET is not defined in the environment variables');
        }

        const mac = crypto.createHmac("sha256", sharedSecret);
        mac.update(payload.subarray(0, 16));
        const payloadSignatureBytes = mac.digest();

        const signatureValid = payload
            .subarray(16)
            .equals(payloadSignatureBytes.subarray(0, 16));
        if (!signatureValid) {
            throw new BadRequestException("Invalid payload signature");
        }

        const now = Math.floor(Date.now() / 1000);

        const expireBytes = payload.subarray(8, 16);
        const expireTime = expireBytes.readBigUint64BE();
        if (BigInt(now) > expireTime) {
            throw new BadRequestException("Payload expired");
        }

        if (now > proof.timestamp + PROOF_TTL) {
            throw new BadRequestException("Ton proof has been expired");
        }

        if (proof.domain.value !== DOMAIN) {
            throw new BadRequestException(`Wrong domain, got ${DOMAIN}, expected dice.xuton.uno`);
        }

        if (proof.domain.lengthBytes !== proof.domain.value.length) {
            throw new BadRequestException(`Domain length mismatched against provided length bytes of ${proof.domain.lengthBytes}`);
        }

        const parsedAddress = Address.parse(address);

        const wc = Buffer.alloc(4);
        wc.writeInt32BE(parsedAddress.workChain);

        const ts = Buffer.alloc(8);
        ts.writeBigUint64LE(BigInt(proof.timestamp));

        const dl = Buffer.alloc(4);
        dl.writeUint32LE(proof.domain.value.length);

        const tonProofPrefix = "ton-proof-item-v2/";
        const msg = Buffer.concat([
            Buffer.from(tonProofPrefix),
            wc,
            parsedAddress.hash,
            dl,
            Buffer.from(proof.domain.value),
            ts,
            Buffer.from(proof.payload),
        ]);

        const msgHash = crypto.createHash("sha256").update(msg).digest();

        const tonConnectPrefix = "ton-connect";
        const fullMsg = Buffer.concat([
            Buffer.from([0xff, 0xff]),
            Buffer.from(tonConnectPrefix),
            msgHash,
        ]);

        const fullMsgHash = crypto.createHash("sha256").update(fullMsg).digest();

        const tonapikey = this.configService.get<string>('TONAPIKEY');
        if (!tonapikey) {
            throw new InternalServerErrorException('TONAPIKEY is not defined in the environment variables');
        }

        const client = new TonApiClient({
            baseUrl: 'https://tonapi.io',
            apiKey: tonapikey
        });

        let pubkey: Buffer = Buffer.from((await client.accounts.getAccountPublicKey(Address.parse(address))).publicKey, "hex");

        const proofSignatureBytes = Buffer.from(proof.signature, "base64");
        const verified = nacl.sign.detached.verify(
            fullMsgHash,
            proofSignatureBytes,
            pubkey
        );

        if (!verified) {
            throw new UnauthorizedException('Verification failed');
        }

        let user = await this.prisma.user.findUnique({
            where: { wallet: address }
        })

        if (!user) {
            user = await this.prisma.user.create({
                data: { wallet: address },
            });
        }

        return await this.generateAccessToken(address);
    }
}
