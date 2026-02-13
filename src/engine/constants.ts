
export const DEFAULT_COMPUTE_UNITS = 1_400_000;
export const DEFAULT_PRIORITY_FEE = 1000; // Micro-lamports
export const SIMULATION_RETRY_DELAY = 1000;
export const MAX_CONFIRMATION_ATTEMPTS = 60; // 60 seconds roughly
export const CONFIRMATION_POLL_INTERVAL = 1000;

// Hardcoded for now, but should be fetched via getMint
export const SOL_DECIMALS = 9;
export const USDC_DECIMALS = 6;

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOL_MINT = "So11111111111111111111111111111111111111112";

// Fallback thresholds if SDK does not provide them
export const LIQUIDATION_THRESHOLDS: Record<string, number> = {
    [SOL_MINT]: 0.80, // 80% LTV for SOL
    [USDC_MINT]: 0.85, // 85% LTV for USDC (though usually collateral is volatile)
};
