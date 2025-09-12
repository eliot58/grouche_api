import { Body, Controller, HttpCode, Post, Query, UnauthorizedException, Headers } from '@nestjs/common';

@Controller('webhook')
export class WebhookController {
    @Post()
    @HttpCode(200)
    async handle(
        @Headers('authorization') authorization: string | undefined,
        @Query('token') tokenQuery: string | undefined,
        @Body() body: any,
    ) {
        const incomingSecret = process.env.WEBHOOK_INCOMING_TOKEN;
        if (!incomingSecret) {
            throw new Error(
                'WEBHOOK_INCOMING_TOKEN is not set. Please set it in environment.',
            );
        }

        console.log(authorization)

        console.log(tokenQuery)

        const bearer = authorization?.startsWith('Bearer ')
            ? authorization.slice('Bearer '.length)
            : undefined;

        const ok = bearer === incomingSecret || tokenQuery === incomingSecret;
        if (!ok) {
            throw new UnauthorizedException('Invalid webhook token');
        }

        console.log(body);

        return { ok: true };
    }
}
