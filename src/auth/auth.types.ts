import { FastifyRequest } from 'fastify';

export type AuthPayload = {
    address: string;
};

export type RequestWithAuth = FastifyRequest & AuthPayload;
