import { describe, it, expect, vi, beforeEach } from "vitest";
import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { buildLendingTransaction } from "../../engine/builder";
import { LendingTransactionInput } from "../../engine/types";
import * as jup from "@jup-ag/lend/borrow";

// Mock the external dependencies
vi.mock("@jup-ag/lend/borrow", () => ({
    getOperateIx: vi.fn(),
}));

vi.mock("@/lib/solana", () => ({
    getMintDecimals: vi.fn(async (_conn: any, mint: any) => {
        const m = mint.toBase58();
        if (m === "So11111111111111111111111111111111111111112") return 9;
        if (m === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") return 6;
        return 9;
    }),
}));

// Mock Connection
const mockConnection = {
    getAccountInfo: vi.fn(),
} as unknown as Connection;

describe("buildLendingTransaction", () => {
    const userPublicKey = new PublicKey("11111111111111111111111111111111");

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should build deposit transaction correctly", async () => {
        // Mock getOperateIx return value
        const mockIx = new TransactionInstruction({
            keys: [],
            programId: new PublicKey("11111111111111111111111111111111"),
            data: Buffer.from([]),
        });

        (jup.getOperateIx as any).mockResolvedValue({
            ixs: [mockIx],
            addressLookupTableAccounts: [],
        });

        const input: LendingTransactionInput = {
            vaultId: 1,
            positionId: 330,
            colAmount: 1.5, // 1.5 SOL
            debtAmount: 0,
            userPublicKey,
            priorityFeeMicroLamports: 5000,
        };

        // Assume WSOL account exists (mock getAccountInfo returns something)
        (mockConnection.getAccountInfo as any).mockResolvedValue({});

        const result = await buildLendingTransaction(mockConnection, input);

        expect(result.instructions.length).toBeGreaterThan(0);
        expect(result.metadata.computeUnits).toBe(1400000); // Default
        expect(result.metadata.priorityFeeMicroLamports).toBe(5000); // Input

        // When WSOL account exists: Transfer(1) + Sync(1) + Operate(1) = 3
        expect(result.instructions.length).toBe(3);
        expect(result.computeBudgetInstructions.length).toBe(2);
    });
});
