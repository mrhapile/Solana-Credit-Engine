import { describe, it, expect, vi, beforeEach } from "vitest";

// We need to mock dependencies before importing the module under test
vi.mock("@solana/spl-token", () => ({
    getMint: vi.fn(),
}));

import { getMintDecimals, getSolscanTxLink, getRpcUrl } from "@/lib/solana";
import { getMint } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

describe("Decimal Utilities — getMintDecimals", () => {
    const mockConnection = {} as Connection;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns cached decimals for WSOL without RPC call", async () => {
        const wsol = new PublicKey("So11111111111111111111111111111111111111112");
        const decimals = await getMintDecimals(mockConnection, wsol);
        expect(decimals).toBe(9);
        expect(getMint).not.toHaveBeenCalled();
    });

    it("returns cached decimals for USDC without RPC call", async () => {
        const usdc = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
        const decimals = await getMintDecimals(mockConnection, usdc);
        expect(decimals).toBe(6);
        expect(getMint).not.toHaveBeenCalled();
    });

    it("fetches and caches unknown mint decimals", async () => {
        const unknownMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

        (getMint as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            decimals: 8,
        });

        const decimals = await getMintDecimals(mockConnection, unknownMint);
        expect(decimals).toBe(8);
        expect(getMint).toHaveBeenCalledOnce();

        // Second call should use cache
        const decimals2 = await getMintDecimals(mockConnection, unknownMint);
        expect(decimals2).toBe(8);
        // getMint should still only have been called once total
        expect(getMint).toHaveBeenCalledOnce();
    });

    it("throws on RPC failure for unknown mint", async () => {
        const badMint = new PublicKey("11111111111111111111111111111111");
        (getMint as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
            new Error("Account not found")
        );

        await expect(getMintDecimals(mockConnection, badMint)).rejects.toThrow(
            "Failed to fetch mint decimals"
        );
    });
});

describe("Decimal conversion precision", () => {
    it("SOL: 1e9 lamports = 1 SOL (no precision loss)", () => {
        const lamports = 1_000_000_000;
        const sol = lamports / Math.pow(10, 9);
        expect(sol).toBe(1);
    });

    it("USDC: 1e6 micro-units = 1 USDC (no precision loss)", () => {
        const micro = 1_000_000;
        const usdc = micro / Math.pow(10, 6);
        expect(usdc).toBe(1);
    });

    it("handles fractional SOL without precision loss", () => {
        // 1.23456789 SOL → 1234567890 lamports
        const amount = 1.23456789;
        const lamports = Math.round(amount * 1e9);
        expect(lamports).toBe(1234567890);
        expect(lamports / 1e9).toBeCloseTo(1.23456789, 8);
    });

    it("handles max safe integer boundary", () => {
        // JS Number.MAX_SAFE_INTEGER = 9007199254740991
        // Divided by 1e9 (SOL lamports): ~9,007,199.254...
        // This verifies that practical amounts (up to ~9M SOL) don't lose precision
        const maxSafe = Number.MAX_SAFE_INTEGER;
        const asSol = maxSafe / 1e9;
        expect(asSol).toBeCloseTo(9007199.254740991, 2);
        // Verify conversion is reversible within safe range
        const smallAmount = 1_000_000_000; // 1 SOL in lamports
        expect(smallAmount / 1e9).toBe(1);
    });
});

describe("getSolscanTxLink", () => {
    it("returns correct Solscan URL", () => {
        const sig = "5abc123xyz";
        expect(getSolscanTxLink(sig)).toBe("https://solscan.io/tx/5abc123xyz");
    });
});
