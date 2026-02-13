
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";

// Types
export type OperationType = "deposit" | "withdraw" | "borrow" | "repay";

export interface RiskMetrics {
    currentHF: number;
    projectedHF: number;
    currentLTV: number;
    projectedLTV: number;
    liquidationPrice: number;
    percentDropToLiquidation: number;
    riskLevel: RiskLevel;
}

export type RiskLevel = "safe" | "moderate" | "high" | "liquidation";

interface RiskCalculationInput {
    currentCollateralAmount: BN; // Raw amount
    currentDebtAmount: BN;       // Raw amount
    collateralDecimals: number;
    debtDecimals: number;
    collateralPrice: number;
    debtPrice: number;           // Usually 1 for USDC
    liquidationThreshold: number; // e.g. 0.80
    operation: OperationType;
    amount: number;              // User input amount in natural units (e.g. 1.5 SOL)
}

/**
 * Calculates risk metrics based on current position and proposed operation.
 * Pure function. Uses BN for precision where possible, converts to number for final ratios.
 */
export function calculateProjectedRisk(input: RiskCalculationInput): RiskMetrics {
    const {
        currentCollateralAmount,
        currentDebtAmount,
        collateralDecimals,
        debtDecimals,
        collateralPrice,
        debtPrice,
        liquidationThreshold,
        operation,
        amount
    } = input;

    // 1. Calculate Deltas in Raw Units
    let collateralChange = new BN(0);
    let debtChange = new BN(0);

    // Convert input amount to raw units
    const decimals = operation === 'deposit' || operation === 'withdraw' ? collateralDecimals : debtDecimals;
    const amountRaw = !isNaN(amount) && amount > 0
        ? new BN(Math.round(amount * Math.pow(10, decimals)))
        : new BN(0);

    switch (operation) {
        case "deposit":
            collateralChange = amountRaw;
            break;
        case "withdraw":
            collateralChange = amountRaw.neg();
            break;
        case "borrow":
            debtChange = amountRaw;
            break;
        case "repay":
            debtChange = amountRaw.neg();
            break;
    }

    // 2. Calculate Projected Amounts
    const projectedCollateralRaw = currentCollateralAmount.add(collateralChange);
    const projectedDebtRaw = currentDebtAmount.add(debtChange);

    // Ensure no negative values (clamp to 0)
    const finalCollateralRaw = projectedCollateralRaw.isNeg() ? new BN(0) : projectedCollateralRaw;
    const finalDebtRaw = projectedDebtRaw.isNeg() ? new BN(0) : projectedDebtRaw;

    // 3. Convert to Values (USD)
    // We use number for value calculation as prices are float.
    // Ideally we'd use a price oracle with decimals but provided prices are numbers.

    // Constants for division
    const colDivisor = Math.pow(10, collateralDecimals);
    const debtDivisor = Math.pow(10, debtDecimals);

    const currentCollateralVal = (currentCollateralAmount.toNumber() / colDivisor) * collateralPrice;
    const currentDebtVal = (currentDebtAmount.toNumber() / debtDivisor) * debtPrice;

    const projectedCollateralVal = (finalCollateralRaw.toNumber() / colDivisor) * collateralPrice;
    const projectedDebtVal = (finalDebtRaw.toNumber() / debtDivisor) * debtPrice;

    // 4. Calculate Risk Metrics

    // Health Factor = (Collateral Value * Liquidation Threshold) / Debt Value
    const calculateHF = (colVal: number, debtVal: number): number => {
        if (debtVal <= 0.000001) return Infinity; // No debt = infinite, effectively safe
        if (colVal <= 0) return 0; // Debt but no collateral = 0 health
        return (colVal * liquidationThreshold) / debtVal;
    };

    const currentHF = calculateHF(currentCollateralVal, currentDebtVal);
    const projectedHF = calculateHF(projectedCollateralVal, projectedDebtVal);

    // LTV = Debt Value / Collateral Value
    const calculateLTV = (colVal: number, debtVal: number): number => {
        if (colVal <= 0.000001) return 0; // No collateral implies 0 LTV logically if no debt, or infinite if debt exists... 
        // Standard definition: Debt/Collat. If Collat=0, Undefined/Inf.
        if (debtVal <= 0) return 0;
        return debtVal / colVal;
    };

    const currentLTV = calculateLTV(currentCollateralVal, currentDebtVal);
    const projectedLTV = calculateLTV(projectedCollateralVal, projectedDebtVal);

    // Liquidation Price
    // Price at which HF = 1
    // 1 = (CollateralAmount * Price * Threshold) / DebtValue
    // DebtValue = CollateralAmount * Price * Threshold
    // Price = DebtValue / (CollateralAmount * Threshold)

    // We calculate liquidation price of the Collateral Asset (SOL) against the Debt Asset (USDC).
    // Assuming Debt is stable (USDC). If Debt is volatile, it's more complex (relative price).
    // Assuming standard usage: Collateral = SOL, Debt = USDC.

    const calculateLiqPrice = (colAmountRaw: BN, debtVal: number): number => {
        const colAmount = colAmountRaw.toNumber() / colDivisor;
        if (colAmount <= 0) return 0;
        if (debtVal <= 0) return 0;

        return debtVal / (colAmount * liquidationThreshold);
    };

    const liquidationPrice = calculateLiqPrice(finalCollateralRaw, projectedDebtVal);

    // Percent Drop to Liquidation
    // (CurrentPrice - LiqPrice) / CurrentPrice
    let percentDropToLiquidation = 0;
    if (liquidationPrice > 0 && collateralPrice > 0) {
        percentDropToLiquidation = Math.max(0, (collateralPrice - liquidationPrice) / collateralPrice) * 100;
    } else if (projectedHF === Infinity) {
        percentDropToLiquidation = 100; // Can drop 100% and be fine
    }

    // 5. Determine Risk Level
    const riskLevel = getRiskLevel(projectedHF);

    return {
        currentHF,
        projectedHF,
        currentLTV,
        projectedLTV,
        liquidationPrice,
        percentDropToLiquidation,
        riskLevel
    };
}

export function getRiskLevel(hf: number): RiskLevel {
    if (hf > 2.0) return "safe";
    if (hf > 1.2) return "moderate";
    if (hf > 1.05) return "high";
    return "liquidation";
}

export function getRiskColor(level: RiskLevel): string {
    switch (level) {
        case "safe": return "text-emerald-400";
        case "moderate": return "text-yellow-400";
        case "high": return "text-orange-500";
        case "liquidation": return "text-red-500";
    }
}
