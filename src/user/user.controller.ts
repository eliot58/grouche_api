import { Body, Controller, Get, Post, Req, UseGuards, HttpCode } from '@nestjs/common';
import { RequestWithAuth } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
    constructor(
        private readonly userService: UserService
    ) {}

    @Get()
    @UseGuards(JwtAuthGuard)
    async getPlayer(@Req() request: RequestWithAuth) {
        return await this.userService.getUser(request.address)
    }

    @HttpCode(200)
    @Post('checkBurn')
    @UseGuards(JwtAuthGuard)
    async checkBurn(@Req() request: RequestWithAuth, @Body() data: { nft_address: string }) {
        return await this.userService.checkBurn(request.address, data.nft_address)
    }
}
