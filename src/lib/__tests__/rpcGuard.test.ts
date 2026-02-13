import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { safeRpcCall } from "@/lib/rpcGuard";

// ─── RPC Guard Tests ────────────────────────────────────────────
describe("safeRpcCall", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns the result of a successful call", async () => {
        const result = await safeRpcCall(async () => 42, { context: "test" });
        expect(result).toBe(42);
    });

    it("retries on non-429 errors up to MAX_RETRIES (2)", async () => {
        let attempts = 0;
        const fn = async () => {
            attempts++;
            if (attempts <= 2) throw new Error("transient error");
            return "ok";
        };

        const result = await safeRpcCall(fn, { context: "retry-test" });
        expect(result).toBe("ok");
        expect(attempts).toBe(3); // 1 initial + 2 retries
    });

    it("throws after max retries exhausted", async () => {
        const fn = async () => {
            throw new Error("permanent failure");
        };

        await expect(
            safeRpcCall(fn, { context: "exhaust-test" })
        ).rejects.toThrow("permanent failure");
    });

    it("returns fallback value after max retries if provided", async () => {
        const fn = async () => {
            throw new Error("permanent failure");
        };

        const result = await safeRpcCall(fn, {
            context: "fallback-test",
            fallbackValue: "default",
        });
        expect(result).toBe("default");
    });

    // ── 429 Handling ──────────────────────
    describe("429 rate limit handling", () => {
        it("stops retrying immediately on 429 error (message)", async () => {
            let attempts = 0;
            const fn = async () => {
                attempts++;
                throw new Error("HTTP 429 Too Many Requests");
            };

            await expect(
                safeRpcCall(fn, { context: "429-test" })
            ).rejects.toThrow("RPC rate limit reached");

            // Must NOT retry — should be exactly 1 attempt
            expect(attempts).toBe(1);
        });

        it("stops retrying immediately on 429 error (code)", async () => {
            let attempts = 0;
            const fn = async () => {
                attempts++;
                const err = new Error("rate limited") as any;
                err.code = 429;
                throw err;
            };

            await expect(
                safeRpcCall(fn, { context: "429-code-test" })
            ).rejects.toThrow("RPC rate limit reached");

            expect(attempts).toBe(1);
        });

        it("returns fallback value on 429 if provided", async () => {
            const fn = async () => {
                throw new Error("429");
            };

            const result = await safeRpcCall(fn, {
                context: "429-fallback",
                fallbackValue: 42,
            });
            expect(result).toBe(42);
        });
    });

    // ── Spacing Guard ─────────────────────
    describe("Spacing guard (200ms minimum gap)", () => {
        it("enforces spacing between rapid calls", async () => {
            // Use real timers for this test
            vi.useRealTimers();

            const timestamps: number[] = [];
            const fn = async () => {
                timestamps.push(Date.now());
                return "ok";
            };

            // Make two rapid sequential calls
            await safeRpcCall(fn, { context: "spacing-1" });
            await safeRpcCall(fn, { context: "spacing-2" });

            expect(timestamps).toHaveLength(2);
            const gap = timestamps[1] - timestamps[0];
            // Gap should be at least ~200ms (allow some tolerance)
            expect(gap).toBeGreaterThanOrEqual(180);
        });
    });
});
