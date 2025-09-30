import { Body, Controller, Post, HttpCode, Get, Query, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { FastifyReply } from 'fastify';
import { CHAIN } from '@tonconnect/ui-react';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Get('test')
  async getToken(
    @Query('address') address: string,
    @Query('network') network: CHAIN,
  ) {
    return await this.authService.generateAuthToken(address, network);
  }

  @HttpCode(200)
  @Post('generate_payload')
  generatePayload() {
    return this.authService.generatePayload();
  }

  @HttpCode(200)
  @Post('check_proof')
  async checkProof(@Body() data: any, @Res() res: FastifyReply) {
    const { token } = await this.authService.checkProof(data);

    res.setCookie('auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.send({ token });
  }
}
