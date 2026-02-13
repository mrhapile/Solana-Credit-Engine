import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { confirmTransaction } from "@/engine/confirmation";

describe("confirmTransaction", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns true when transaction is confirmed immediately", async () => {
        const connection = {
            getSignatureStatus: vi.fn(async () => ({
                value: {
                    confirmationStatus: "confirmed",
                    err: null,
                },
            })),
        } as any;

        const result = await confirmTransaction(connection, "testSig123");
        expect(result).toBe(true);
    });

    it("throws when transaction has on-chain error", async () => {
        const connection = {
            getSignatureStatus: vi.fn(async () => ({
                value: {
                    confirmationStatus: "confirmed",
                    err: { InstructionError: [0, "Custom"] },
                },
            })),
        } as any;

        await expect(confirmTransaction(connection, "testSig123")).rejects.toThrow("Transaction failed:");
    });

    it("retries when status is pending and eventually confirms", async () => {
        let callCount = 0;
        const connection = {
            getSignatureStatus: vi.fn(async () => {
                callCount++;
                if (callCount < 3) {
                    return { value: { confirmationStatus: "processed", err: null } };
                }
                return { value: { confirmationStatus: "confirmed", err: null } };
            }),
        } as any;

        const promise = confirmTransaction(connection, "testSig123");

        // Advance timers repeatedly until resolve
        for (let i = 0; i < 5; i++) {
            await vi.advanceTimersByTimeAsync(1000);
        }

        const result = await promise;
        expect(result).toBe(true);
        expect(callCount).toBe(3);
    });
});
