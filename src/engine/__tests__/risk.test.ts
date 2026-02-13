import { describe, it, expect } from "vitest";
import BN from "bn.js";
import { calculateProjectedRisk, getRiskLevel, getRiskColor } from "@/engine/risk";

// ─── Helpers ────────────────────────────────────────────────────
const SOL_DECIMALS = 9;
const USDC_DECIMALS = 6;
const LIQ_THRESHOLD = 0.80;

function makeInput(overrides: Record<string, any> = {}) {
    return {
        currentCollateralAmount: new BN(10 * 1e9), // 10 SOL
        currentDebtAmount: new BN(500 * 1e6),       // 500 USDC
        collateralDecimals: SOL_DECIMALS,
        debtDecimals: USDC_DECIMALS,
        collateralPrice: 150,
        debtPrice: 1,
        liquidationThreshold: LIQ_THRESHOLD,
        operation: "deposit" as const,
        amount: 0,
        ...overrides,
    };
}

// ─── Risk Engine Tests ──────────────────────────────────────────
describe("Risk Engine — calculateProjectedRisk", () => {
    // ── Health Factor ──────────────────────
    describe("Health Factor calculation", () => {
        it("computes correct HF for a standard position", () => {
            const result = calculateProjectedRisk(makeInput());
            // HF = (10 * 150 * 0.80) / 500 = 1200 / 500 = 2.40
            expect(result.currentHF).toBeCloseTo(2.4, 4);
            expect(result.projectedHF).toBeCloseTo(2.4, 4);
        });

        it("returns Infinity HF when debt = 0", () => {
            const result = calculateProjectedRisk(
                makeInput({ currentDebtAmount: new BN(0) })
            );
            expect(result.currentHF).toBe(Infinity);
            expect(result.projectedHF).toBe(Infinity);
        });

        it("returns 0 HF when collateral = 0 and debt > 0", () => {
            const result = calculateProjectedRisk(
                makeInput({ currentCollateralAmount: new BN(0) })
            );
            expect(result.currentHF).toBe(0);
        });

        it("handles HF = 1 boundary precisely", () => {
            // HF = 1 when colVal * threshold = debtVal
            // colVal = 10 * 150 = 1500
            // threshold = 0.80
            // debtVal = 1500 * 0.80 = 1200
            const result = calculateProjectedRisk(
                makeInput({ currentDebtAmount: new BN(1200 * 1e6) })
            );
            expect(result.currentHF).toBeCloseTo(1.0, 4);
        });

        it("projects HF correctly after a deposit", () => {
            const result = calculateProjectedRisk(
                makeInput({ operation: "deposit", amount: 5 })
            );
            // After deposit: col = 15 SOL, debt = 500 USDC
            // HF = (15 * 150 * 0.80) / 500 = 1800 / 500 = 3.6
            expect(result.projectedHF).toBeCloseTo(3.6, 4);
        });

        it("projects HF correctly after a withdrawal", () => {
            const result = calculateProjectedRisk(
                makeInput({ operation: "withdraw", amount: 5 })
            );
            // After withdrawal: col = 5 SOL, debt = 500 USDC
            // HF = (5 * 150 * 0.80) / 500 = 600 / 500 = 1.2
            expect(result.projectedHF).toBeCloseTo(1.2, 4);
        });

        it("projects HF correctly after a borrow", () => {
            const result = calculateProjectedRisk(
                makeInput({ operation: "borrow", amount: 200 })
            );
            // After borrow: col = 10 SOL, debt = 700 USDC
            // HF = (10 * 150 * 0.80) / 700 = 1200 / 700 ≈ 1.7143
            expect(result.projectedHF).toBeCloseTo(1200 / 700, 3);
        });

        it("projects HF correctly after a repay", () => {
            const result = calculateProjectedRisk(
                makeInput({ operation: "repay", amount: 300 })
            );
            // After repay: col = 10 SOL, debt = 200 USDC
            // HF = (10 * 150 * 0.80) / 200 = 1200 / 200 = 6.0
            expect(result.projectedHF).toBeCloseTo(6.0, 4);
        });
    });

    // ── Liquidation Price ──────────────────
    describe("Liquidation Price calculation", () => {
        it("computes correct liquidation price", () => {
            const result = calculateProjectedRisk(makeInput());
            // LiqPrice = debtVal / (colAmount * threshold)
            // = 500 / (10 * 0.80) = 500 / 8 = 62.50
            expect(result.liquidationPrice).toBeCloseTo(62.5, 4);
        });

        it("returns 0 when collateral = 0", () => {
            const result = calculateProjectedRisk(
                makeInput({ currentCollateralAmount: new BN(0) })
            );
            expect(result.liquidationPrice).toBe(0);
        });

        it("returns 0 when debt = 0", () => {
            const result = calculateProjectedRisk(
                makeInput({ currentDebtAmount: new BN(0) })
            );
            expect(result.liquidationPrice).toBe(0);
        });
    });

    // ── LTV ────────────────────────────────
    describe("LTV calculation", () => {
        it("computes correct LTV", () => {
            const result = calculateProjectedRisk(makeInput());
            // LTV = debtVal / colVal = 500 / 1500 ≈ 0.3333
            expect(result.currentLTV).toBeCloseTo(1 / 3, 4);
        });

        it("returns 0 LTV when no debt", () => {
            const result = calculateProjectedRisk(
                makeInput({ currentDebtAmount: new BN(0) })
            );
            expect(result.currentLTV).toBe(0);
        });
    });

    // ── Edge Cases ─────────────────────────
    describe("Edge cases", () => {
        it("clamps negative collateral to 0 (over-withdrawal)", () => {
            const result = calculateProjectedRisk(
                makeInput({
                    currentCollateralAmount: new BN(1 * 1e9), // 1 SOL
                    operation: "withdraw",
                    amount: 5, // withdraw 5 SOL (more than available)
                })
            );
            // finalCollateral clamped to 0
            expect(result.projectedHF).toBe(0);
        });

        it("clamps negative debt to 0 (over-repayment)", () => {
            const result = calculateProjectedRisk(
                makeInput({
                    currentDebtAmount: new BN(100 * 1e6), // 100 USDC
                    operation: "repay",
                    amount: 200, // repay 200 (more than owed)
                })
            );
            // finalDebt clamped to 0 → HF = Infinity
            expect(result.projectedHF).toBe(Infinity);
        });

        it("handles amount = 0 gracefully", () => {
            const result = calculateProjectedRisk(makeInput({ amount: 0 }));
            // No change
            expect(result.currentHF).toBe(result.projectedHF);
        });

        it("handles NaN amount safely", () => {
            const result = calculateProjectedRisk(makeInput({ amount: NaN }));
            expect(result.currentHF).toBe(result.projectedHF);
        });

        it("handles very small fractional amounts", () => {
            const result = calculateProjectedRisk(
                makeInput({ operation: "deposit", amount: 0.000000001 })
            );
            // Should not throw, rounding should be safe
            expect(result.projectedHF).toBeGreaterThanOrEqual(result.currentHF);
        });
    });

    // ── Decimal Rounding Safety ────────────
    describe("Decimal rounding safety", () => {
        it("does not lose precision on 9-decimal SOL amounts", () => {
            const result = calculateProjectedRisk(
                makeInput({
                    currentCollateralAmount: new BN("1234567890"), // 1.23456789 SOL
                    currentDebtAmount: new BN("100000000"),       // 100 USDC
                    collateralPrice: 100,
                })
            );
            // colVal = 1.23456789 * 100 = 123.456789
            // HF = 123.456789 * 0.80 / 100 = 0.98765431...
            expect(result.currentHF).toBeCloseTo(0.98765431, 4);
        });
    });
});

// ─── getRiskLevel tests ─────────────────────────────────────────
describe("getRiskLevel", () => {
    it("safe when HF > 2.0", () => {
        expect(getRiskLevel(2.5)).toBe("safe");
        expect(getRiskLevel(Infinity)).toBe("safe");
    });
    it("moderate when 1.2 < HF <= 2.0", () => {
        expect(getRiskLevel(1.5)).toBe("moderate");
        expect(getRiskLevel(2.0)).toBe("moderate");
    });
    it("high when 1.05 < HF <= 1.2", () => {
        expect(getRiskLevel(1.1)).toBe("high");
        expect(getRiskLevel(1.2)).toBe("high");
    });
    it("liquidation when HF <= 1.05", () => {
        expect(getRiskLevel(1.05)).toBe("liquidation");
        expect(getRiskLevel(0.5)).toBe("liquidation");
        expect(getRiskLevel(0)).toBe("liquidation");
    });
});

// ─── getRiskColor tests ─────────────────────────────────────────
describe("getRiskColor", () => {
    it("returns correct Tailwind classes", () => {
        expect(getRiskColor("safe")).toBe("text-emerald-400");
        expect(getRiskColor("moderate")).toBe("text-yellow-400");
        expect(getRiskColor("high")).toBe("text-orange-500");
        expect(getRiskColor("liquidation")).toBe("text-red-500");
    });
});
