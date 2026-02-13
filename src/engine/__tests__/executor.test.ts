import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rpcGuard", () => ({
    safeRpcCall: vi.fn(async (fn: () => Promise<any>) => fn()),
}));

import { executeLendingTransaction, EngineError } from "@/engine/executor";
import { TxFailureType } from "@/engine/types";

// ── Mock sub-modules ─────────────────────────────────────────
vi.mock("@/engine/builder", () => ({
    buildLendingTransaction: vi.fn(async () => ({
        instructions: [{ keys: [], programId: "test", data: Buffer.alloc(0) }],
        computeBudgetInstructions: [
            { keys: [], programId: "budget1", data: Buffer.alloc(0) },
            { keys: [], programId: "budget2", data: Buffer.alloc(0) },
        ],
        lookupTables: [],
        metadata: {
            expectedColLamports: { toNumber: () => 1e9 },
            expectedDebtLamports: { toNumber: () => 0 },
            computeUnits: 1400000,
            priorityFeeMicroLamports: 1000,
        },
    })),
}));

vi.mock("@/engine/transaction", () => ({
    createVersionedTransaction: vi.fn(async () => ({
        serialize: () => new Uint8Array(100),
    })),
}));

vi.mock("@/engine/simulation", () => ({
    simulateTransaction: vi.fn(async () => ({
        success: true,
        logs: ["log1"],
        unitsConsumed: 50000,
    })),
}));

vi.mock("@/lib/solana", () => ({
    estimatePriorityFee: vi.fn(async () => 5000),
    getSolscanTxLink: vi.fn((sig: string) => `https://solscan.io/tx/${sig}`),
}));

import { Connection, PublicKey } from "@solana/web3.js";

describe("executeLendingTransaction", () => {
    const mockPubkey = new PublicKey("11111111111111111111111111111111");
    const mockConnection = {
        sendRawTransaction: vi.fn(async () => "mockSignature123"),
        confirmTransaction: vi.fn(async () => ({ value: { err: null } })),
        getLatestBlockhash: vi.fn(async () => ({
            blockhash: "mockBlockhash",
            lastValidBlockHeight: 100000,
        })),
    } as unknown as Connection;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws if wallet not connected", async () => {
        const wallet = { publicKey: null, signTransaction: null } as any;

        await expect(
            executeLendingTransaction(mockConnection, wallet, {
                vaultId: 1,
                positionId: 1,
                colAmount: 1,
                debtAmount: 0,
                userPublicKey: mockPubkey,
            })
        ).rejects.toThrow("Wallet not connected");
    });

    it("returns simulation result for simulateOnly", async () => {
        const wallet = {
            publicKey: mockPubkey,
            signTransaction: vi.fn(),
        } as any;

        const result = await executeLendingTransaction(mockConnection, wallet, {
            vaultId: 1,
            positionId: 1,
            colAmount: 1,
            debtAmount: 0,
            userPublicKey: mockPubkey,
            simulateOnly: true,
        });

        expect(result.signature).toBe("simulation_only");
        expect(result.confirmed).toBe(false);
        // signTransaction should NOT have been called
        expect(wallet.signTransaction).not.toHaveBeenCalled();
    });

    it("calls status callbacks in correct order", async () => {
        const statuses: string[] = [];
        const wallet = {
            publicKey: mockPubkey,
            signTransaction: vi.fn(async (tx: any) => tx),
        } as any;

        await executeLendingTransaction(
            mockConnection,
            wallet,
            {
                vaultId: 1,
                positionId: 1,
                colAmount: 1,
                debtAmount: 0,
                userPublicKey: mockPubkey,
            },
            {
                onStatusChange: (status) => statuses.push(status),
            }
        );

        expect(statuses).toContain("building");
        expect(statuses).toContain("simulating");
        expect(statuses).toContain("optimizing");
        expect(statuses).toContain("awaiting_signature");
        expect(statuses).toContain("sending");
        expect(statuses).toContain("confirming");
        expect(statuses).toContain("success");
    });

    it("throws EngineError on user rejection", async () => {
        const wallet = {
            publicKey: mockPubkey,
            signTransaction: vi.fn(async () => {
                throw new Error("User rejected");
            }),
        } as any;

        await expect(
            executeLendingTransaction(mockConnection, wallet, {
                vaultId: 1,
                positionId: 1,
                colAmount: 1,
                debtAmount: 0,
                userPublicKey: mockPubkey,
            })
        ).rejects.toThrow("User rejected transaction");
    });

    it("returns confirmed result with signature and link", async () => {
        const wallet = {
            publicKey: mockPubkey,
            signTransaction: vi.fn(async (tx: any) => tx),
        } as any;

        const result = await executeLendingTransaction(mockConnection, wallet, {
            vaultId: 1,
            positionId: 1,
            colAmount: 1,
            debtAmount: 0,
            userPublicKey: mockPubkey,
        });

        expect(result.signature).toBe("mockSignature123");
        expect(result.confirmed).toBe(true);
        expect(result.link).toContain("solscan.io");
    });
});

describe("EngineError", () => {
    it("carries type and logs", () => {
        const err = new EngineError(
            "test error",
            TxFailureType.SimulationFailure,
            ["log1", "log2"]
        );
        expect(err.type).toBe(TxFailureType.SimulationFailure);
        expect(err.logs).toEqual(["log1", "log2"]);
        expect(err.message).toBe("test error");
    });
});
