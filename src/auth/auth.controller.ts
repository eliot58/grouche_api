import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService
    ){}

    @Post('generate-payload')
    generatePayload() {
        return this.authService.generatePayload();
    }

    @Post('connect')
    async connectWallet(@Body() data: any) {
        return await this.authService.connect(data)
    }
}
