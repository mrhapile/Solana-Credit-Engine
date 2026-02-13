import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dependencies ────────────────────────────────────────
vi.mock("@solana/web3.js", async () => {
    const actual = await vi.importActual("@solana/web3.js");
    return {
        ...actual,
        Connection: vi.fn(),
    };
});

vi.mock("@/lib/rpcGuard", () => ({
    safeRpcCall: vi.fn(async (fn: () => Promise<any>) => fn()),
}));

import { simulateTransaction } from "@/engine/simulation";
import { TxFailureType } from "@/engine/types";
import { VersionedTransaction } from "@solana/web3.js";

describe("simulateTransaction", () => {
    const mockTransaction = {} as VersionedTransaction;

    function createMockConnection(simulationResult: any) {
        return {
            simulateTransaction: vi.fn(async () => ({ value: simulationResult })),
        } as any;
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns success with units consumed on successful simulation", async () => {
        const connection = createMockConnection({
            err: null,
            logs: ["Program log: success"],
            unitsConsumed: 50000,
        });

        const result = await simulateTransaction(connection, mockTransaction);

        expect(result.success).toBe(true);
        expect(result.unitsConsumed).toBe(50000);
        expect(result.logs).toEqual(["Program log: success"]);
    });

    it("returns SimulationFailure for generic errors", async () => {
        const connection = createMockConnection({
            err: { InstructionError: [0, "Custom"] },
            logs: ["Program log: failed"],
        });

        const result = await simulateTransaction(connection, mockTransaction);

        expect(result.success).toBe(false);
        expect(result.failureType).toBe(TxFailureType.SimulationFailure);
    });

    it("detects SlippageExceeded from logs", async () => {
        const connection = createMockConnection({
            err: { InstructionError: [0, "Custom"] },
            logs: ["Program log: Slippage tolerance exceeded"],
        });

        const result = await simulateTransaction(connection, mockTransaction);

        expect(result.success).toBe(false);
        expect(result.failureType).toBe(TxFailureType.SlippageExceeded);
    });

    it("detects InsufficientFunds from error string", async () => {
        const connection = createMockConnection({
            err: "InsufficientFunds",
            logs: [],
        });

        const result = await simulateTransaction(connection, mockTransaction);

        expect(result.success).toBe(false);
        expect(result.failureType).toBe(TxFailureType.InsufficientFunds);
    });

    it("detects InsufficientFunds from 0x1 log", async () => {
        const connection = createMockConnection({
            err: { InstructionError: [0, "Custom"] },
            logs: ["Program log: Error: 0x1"],
        });

        const result = await simulateTransaction(connection, mockTransaction);

        expect(result.success).toBe(false);
        expect(result.failureType).toBe(TxFailureType.InsufficientFunds);
    });

    it("detects BlockhashExpired", async () => {
        const connection = createMockConnection({
            err: "BlockhashNotFound",
            logs: [],
        });

        const result = await simulateTransaction(connection, mockTransaction);

        expect(result.success).toBe(false);
        expect(result.failureType).toBe(TxFailureType.BlockhashExpired);
    });

    it("handles RPC error gracefully", async () => {
        const connection = {
            simulateTransaction: vi.fn(async () => {
                throw new Error("RPC timeout");
            }),
        } as any;

        const result = await simulateTransaction(connection, mockTransaction);

        expect(result.success).toBe(false);
        expect(result.failureType).toBe(TxFailureType.RPCError);
        expect(result.error).toBe("RPC timeout");
    });

    it("handles missing logs gracefully", async () => {
        const connection = createMockConnection({
            err: null,
            logs: null,
            unitsConsumed: 1000,
        });

        const result = await simulateTransaction(connection, mockTransaction);

        expect(result.success).toBe(true);
        expect(result.logs).toEqual([]);
    });
});
