import { CHAIN } from '@tonconnect/ui-react';

export interface AuthToken {
  address: string;
  network: CHAIN;
}

export type PayloadToken = {
  randomBytes: string;
};
