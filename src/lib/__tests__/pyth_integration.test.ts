import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchPythSolPrice, getSolPrice, clearPythPriceCache } from "@/lib/pyth";

vi.mock("@/lib/solana", () => ({
    getConnection: vi.fn(() => ({
        getAccountInfo: vi.fn(),
    })),
}));

vi.mock("@/lib/rpcGuard", () => ({
    safeRpcCall: vi.fn(async (fn: () => Promise<any>) => fn()),
}));

import { getConnection } from "@/lib/solana";

describe("Pyth Oracle — Integration", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        clearPythPriceCache();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("fetches and parses price successfully", async () => {
        const mockData = Buffer.alloc(300);
        mockData.writeUInt32LE(0xa1b2c3d4, 0); // Magic
        mockData.writeInt32LE(-8, 20); // Exponent
        mockData.writeBigInt64LE(BigInt(15000000000), 208); // Price 150.00
        mockData.writeUInt32LE(1, 224); // Status: Trading

        const mockGetAccountInfo = vi.fn().mockResolvedValue({
            data: mockData,
        });

        (getConnection as any).mockReturnValue({
            getAccountInfo: mockGetAccountInfo,
        });

        const result = await fetchPythSolPrice();
        expect(result.price).toBe(150);
        expect(result.source).toBe("pyth");
    });

    it("falls back to REST API when Pyth fails", async () => {
        // Mock Pyth to fail
        (getConnection as any).mockReturnValue({
            getAccountInfo: vi.fn().mockRejectedValue(new Error("RPC Fail")),
        });

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    "So11111111111111111111111111111111111111112": { price: "145.50" }
                }
            })
        });
        global.fetch = mockFetch;

        const price = await getSolPrice();
        expect(price).toBe(145.50);
    });

    it("throws when both Pyth and REST fail", async () => {
        (getConnection as any).mockReturnValue({
            getAccountInfo: vi.fn().mockRejectedValue(new Error("Pyth Fail")),
        });
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500
        });

        await expect(getSolPrice()).rejects.toThrow("All price sources unavailable");
    });
});
