import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TonApiClient } from '@ton-api/client';

@Global()
@Module({})
export class TonApiCoreModule {
    static forRootAsync(): DynamicModule {
        return {
            module: TonApiCoreModule,
            providers: [
                {
                    provide: "TONAPI_CLIENT",
                    useFactory: (cfg: ConfigService) => {
                        const apiKey = cfg.get<string>('TONAPI_KEY');
                        const baseUrl = 'https://tonapi.io';
                        return new TonApiClient({ apiKey, baseUrl });
                    },
                    inject: [ConfigService],
                },
            ],
            exports: ["TONAPI_CLIENT"],
        };
    }
}
