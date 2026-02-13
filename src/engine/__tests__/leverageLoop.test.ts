import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dependencies ────────────────────────────────────────
vi.mock("@jup-ag/lend/borrow", () => ({
    getOperateIx: vi.fn(async () => ({
        ixs: [{ keys: [], programId: "lending", data: Buffer.alloc(0) }],
        addressLookupTableAccounts: [],
    })),
}));

vi.mock("@/engine/risk", () => ({
    calculateProjectedRisk: vi.fn(() => ({
        healthFactor: 1.5,
        liquidationPrice: 100,
        riskLevel: "moderate",
    })),
}));

// Mock global fetch for Jupiter
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { buildLeverageLoop } from "@/engine/leverageLoop";
import { PublicKey, Connection } from "@solana/web3.js";
import BN from "bn.js";

describe("leverageLoop engine", () => {
    const mockPubkey = new PublicKey("11111111111111111111111111111111");
    const mockConnection = {} as Connection;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock Jupiter Quote
        mockFetch.mockImplementation(async (url: string) => {
            if (url.includes("quote")) {
                return {
                    ok: true,
                    json: async () => ({
                        outAmount: "1000000000", // 1 SOL (9 decimals)
                    }),
                };
            }
            if (url.includes("swap-instructions")) {
                return {
                    ok: true,
                    json: async () => ({
                        setupInstructions: [],
                        swapInstruction: {
                            programId: "JUP666",
                            accounts: [],
                            data: Buffer.alloc(0).toString("base64"),
                        },
                        cleanupInstruction: null,
                    }),
                };
            }
            return { ok: false };
        });
    });

    it("composes all instructions into an atomic set", async () => {
        const result = await buildLeverageLoop({
            vaultId: 1,
            positionId: 1,
            userPublicKey: mockPubkey,
            connection: mockConnection,
            initialDepositSol: 1,
            borrowAmountUsdc: 100,
            solPrice: 150,
            currentCollateralRaw: new BN(0),
            currentDebtRaw: new BN(0),
        });

        // Debugging
        // console.log("Instructions length:", result.allInstructions.length);
        // console.log("Pre-swap:", result.preSwapInstructions.length);
        // console.log("Swap:", result.swapInstructions.length);
        // console.log("Post-swap:", result.postSwapInstructions.length);

        expect(result.allInstructions.length).toBeGreaterThanOrEqual(3);
        expect(result.lookupTables).toBeDefined();

        // Check projections
        expect(result.totalCollateralSol).toBe(2); // 1 initial + 1 from swap
        expect(result.totalDebtUsdc).toBe(100);
        expect(result.projectedRisk).toBeDefined();
    });

    it("throws if Jupiter quote fails", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

        await expect(buildLeverageLoop({
            vaultId: 1,
            positionId: 1,
            userPublicKey: mockPubkey,
            connection: mockConnection,
            initialDepositSol: 1,
            borrowAmountUsdc: 100,
            solPrice: 150,
            currentCollateralRaw: new BN(0),
            currentDebtRaw: new BN(0),
        })).rejects.toThrow("Jupiter quote failed");
    });
});
