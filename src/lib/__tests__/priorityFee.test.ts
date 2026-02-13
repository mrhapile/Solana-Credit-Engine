import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock rpcGuard to pass through
vi.mock("@/lib/rpcGuard", () => ({
    safeRpcCall: vi.fn(async (fn: () => Promise<any>, _opts?: any) => fn()),
}));

// Mock spl-token
vi.mock("@solana/spl-token", () => ({
    getMint: vi.fn(),
}));

import { estimatePriorityFee } from "@/lib/solana";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";

describe("estimatePriorityFee", () => {
    const mockInstruction: TransactionInstruction = {
        keys: [
            {
                pubkey: new PublicKey("11111111111111111111111111111111"),
                isSigner: false,
                isWritable: true,
            },
        ],
        programId: new PublicKey("11111111111111111111111111111111"),
        data: Buffer.alloc(0),
    };

    // Use a shared start time that we advance monotonically
    let currentTime = new Date(2024, 1, 1, 12, 0, 0).getTime();

    beforeEach(() => {
        vi.useFakeTimers();
        // Don't reset to the same time every test, keep it moving forward
        // to avoid timestamp collisions with module-level cache
        currentTime += 10 * 60 * 1000; // Advance 10 mins each test
        vi.setSystemTime(currentTime);
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns default fee when no recent fees exist", async () => {
        const connection = {
            getRecentPrioritizationFees: vi.fn(async () => []),
        } as any;

        const fee = await estimatePriorityFee(connection, [mockInstruction]);
        expect(fee).toBe(1000); // DEFAULT_FEE
    });

    it("returns p75 fee from recent fees", async () => {
        const connection = {
            getRecentPrioritizationFees: vi.fn(async () => [
                { prioritizationFee: 100 },
                { prioritizationFee: 200 },
                { prioritizationFee: 500 },
                { prioritizationFee: 5000 },
            ]),
        } as any;

        // Advance enough to expire any cache from previous test
        vi.advanceTimersByTime(70000);

        const fee = await estimatePriorityFee(connection, [mockInstruction]);
        expect(fee).toBe(5000);
    });

    it("enforces minimum default fee", async () => {
        const connection = {
            getRecentPrioritizationFees: vi.fn(async () => [
                { prioritizationFee: 1 },
                { prioritizationFee: 2 },
                { prioritizationFee: 3 },
                { prioritizationFee: 4 },
            ]),
        } as any;

        // Advance enough to expire any cache from previous test
        vi.advanceTimersByTime(70000);

        const fee = await estimatePriorityFee(connection, [mockInstruction]);
        expect(fee).toBe(1000);
    });
});
