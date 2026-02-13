import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock all external dependencies ──────────────────────────────
vi.mock("@solana/spl-token", () => ({
    getMint: vi.fn(),
    getAssociatedTokenAddressSync: vi.fn(() => ({
        toBase58: () => "mockWsolAta",
    })),
    createAssociatedTokenAccountInstruction: vi.fn(() => ({
        keys: [],
        programId: { toBase58: () => "ata-program" },
        data: Buffer.alloc(0),
    })),
    createSyncNativeInstruction: vi.fn(() => ({
        keys: [],
        programId: { toBase58: () => "sync-native" },
        data: Buffer.alloc(0),
    })),
    NATIVE_MINT: { toBase58: () => "So11111111111111111111111111111111111111112" },
}));

vi.mock("@jup-ag/lend/borrow", () => ({
    getOperateIx: vi.fn(async () => ({
        ixs: [
            {
                keys: [{ pubkey: { toBase58: () => "key1" }, isSigner: false, isWritable: true }],
                programId: { toBase58: () => "lending-program" },
                data: Buffer.alloc(0),
            },
        ],
        addressLookupTableAccounts: [],
    })),
}));

vi.mock("@/lib/solana", () => ({
    getMintDecimals: vi.fn(async (_conn: any, mint: any) => {
        const m = mint.toBase58();
        if (m === "So11111111111111111111111111111111111111112") return 9;
        if (m === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") return 6;
        return 9;
    }),
}));

import { buildLendingTransaction } from "@/engine/builder";
import { PublicKey, Connection } from "@solana/web3.js";

describe("Transaction Builder Integration", () => {
    const mockConnection = {
        getAccountInfo: vi.fn(async () => null), // WSOL ATA doesn't exist
    } as unknown as Connection;

    const mockPubkey = new PublicKey("11111111111111111111111111111111");

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns a structured ComputedTransaction object", async () => {
        const result = await buildLendingTransaction(mockConnection, {
            vaultId: 1,
            positionId: 1,
            colAmount: 1.5,
            debtAmount: 0,
            userPublicKey: mockPubkey,
            simulateOnly: true,
        });

        // Verify structure
        expect(result).toHaveProperty("instructions");
        expect(result).toHaveProperty("computeBudgetInstructions");
        expect(result).toHaveProperty("lookupTables");
        expect(result).toHaveProperty("metadata");

        // Verify metadata types
        expect(result.metadata).toHaveProperty("expectedColLamports");
        expect(result.metadata).toHaveProperty("expectedDebtLamports");
        expect(result.metadata).toHaveProperty("computeUnits");
        expect(result.metadata).toHaveProperty("priorityFeeMicroLamports");

        // Verify instructions array is non-empty
        expect(result.instructions.length).toBeGreaterThan(0);

        // Verify compute budget instructions
        expect(result.computeBudgetInstructions).toHaveLength(2);
    });

    it("does NOT call wallet during simulateOnly", async () => {
        // The wallet context is not passed to buildLendingTransaction at all
        // Verification: no signTransaction is required; builder is wallet-free
        const result = await buildLendingTransaction(mockConnection, {
            vaultId: 1,
            positionId: 1,
            colAmount: 0,
            debtAmount: 100,
            userPublicKey: mockPubkey,
            simulateOnly: true,
        });

        // Builder should succeed without any wallet interaction
        expect(result).toBeDefined();
        expect(result.metadata.expectedDebtLamports.toNumber()).toBe(100 * 1e6);
    });

    it("computes correct lamport amounts from natural units", async () => {
        const result = await buildLendingTransaction(mockConnection, {
            vaultId: 1,
            positionId: 1,
            colAmount: 2.5,   // 2.5 SOL
            debtAmount: 500,  // 500 USDC
            userPublicKey: mockPubkey,
        });

        // 2.5 SOL = 2_500_000_000 lamports
        expect(result.metadata.expectedColLamports.toNumber()).toBe(2_500_000_000);
        // 500 USDC = 500_000_000 micro-units
        expect(result.metadata.expectedDebtLamports.toNumber()).toBe(500_000_000);
    });

    it("includes WSOL wrapping instructions for positive collateral", async () => {
        const result = await buildLendingTransaction(mockConnection, {
            vaultId: 1,
            positionId: 1,
            colAmount: 1,
            debtAmount: 0,
            userPublicKey: mockPubkey,
        });

        // Should have: ATA create + SOL transfer + SyncNative + lending IX
        expect(result.instructions.length).toBeGreaterThanOrEqual(3);
    });

    it("skips WSOL wrapping for zero/negative collateral", async () => {
        const result = await buildLendingTransaction(mockConnection, {
            vaultId: 1,
            positionId: 1,
            colAmount: 0,
            debtAmount: 50,
            userPublicKey: mockPubkey,
        });

        // Should only have lending IX (no wrapping)
        expect(result.instructions).toHaveLength(1);
    });
});
