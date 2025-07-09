import { CHAIN } from '@tonconnect/ui-react';
import { FastifyRequest } from 'fastify';

export type AuthPayload = {
  address: string;
  network: CHAIN;
};

export type RequestWithAuth = FastifyRequest & AuthPayload;
