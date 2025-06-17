import { z } from "zod";

const TonAddress = z.string();

export const GenerateTonProofPayload = z.object({
    payload: z.string(),
});

const TonDomain = z.object({
    lengthBytes: z.number(),
    value: z.string(),
});

const TonProof = z.object({
    domain: TonDomain,
    payload: z.string(),
    signature: z.string(),
    state_init: z.string(),
    timestamp: z.number(),
});

const TonNetwork = z.union([
    z.literal("-239").transform(() => "MAINNET" as const),
    z.literal("-3").transform(() => "TESTNET" as const),
]);

export const CheckProofPayload = z.object({
    address: TonAddress,
    network: TonNetwork,
    proof: TonProof,
});

export const CheckTonProofSuccess = z.object({
    token: z.string(),
});

export const CheckTonProofError = z.object({
    error: z.string(),
});

export const CheckTonProof = z.union([
    CheckTonProofSuccess,
    CheckTonProofError,
]);

export const WalletAddress = z.object({
    address: z.string(),
});

export type TGenerateTonProofPayload = z.infer<typeof GenerateTonProofPayload>;
export type TTonDomain = z.infer<typeof TonDomain>;
export type TTonProof = z.infer<typeof TonProof>;
export type TTonNetwork = z.infer<typeof TonNetwork>;
export type TCheckProofPayload = z.infer<typeof CheckProofPayload>;
export type TCheckTonProof = z.infer<typeof CheckTonProof>;
export type TCheckTonProofSuccess = z.infer<typeof CheckTonProofSuccess>;
export type TCheckTonProofError = z.infer<typeof CheckTonProofError>;
export type TWalletAddress = z.infer<typeof WalletAddress>;