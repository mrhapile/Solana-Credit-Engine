/**
 * leverageLoop.ts — Atomic Leverage Loop Builder
 *
 * Implements a single-transaction leverage loop:
 *   1. Deposit SOL as collateral
 *   2. Borrow USDC against it
 *   3. Swap USDC → SOL via Jupiter
 *   4. Deposit resulting SOL as additional collateral
 *
 * All four steps are composed into a single atomic transaction
 * that goes through the standard simulate → preview → confirm flow.
 */

import {
    Connection,
    PublicKey,
    TransactionInstruction,
    VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { getOperateIx } from "@jup-ag/lend/borrow";
import { calculateProjectedRisk, RiskMetrics } from "./risk";
import { SOL_DECIMALS, USDC_DECIMALS, SOL_MINT, USDC_MINT, LIQUIDATION_THRESHOLDS } from "./constants";
import { getMintDecimals } from "../lib/solana";

// ── Types ─────────────────────────────────────────────────────
export interface LeverageLoopInput {
    vaultId: number;
    positionId: number;
    userPublicKey: PublicKey;
    connection: Connection;

    /** Amount of SOL to deposit initially */
    initialDepositSol: number;
    /** Amount of USDC to borrow */
    borrowAmountUsdc: number;
    /** Current SOL price (from Pyth oracle) */
    solPrice: number;

    /** Current position state (raw BN amounts) */
    currentCollateralRaw: BN;
    currentDebtRaw: BN;

    /** Slippage tolerance for Jupiter swap in BPS (e.g., 50 = 0.5%) */
    slippageBps?: number;
}

export interface LeverageLoopResult {
    /** Pre-swap instructions (deposit + borrow) */
    preSwapInstructions: TransactionInstruction[];
    /** Jupiter swap instructions (USDC → SOL) */
    swapInstructions: TransactionInstruction[];
    /** Post-swap instructions (deposit swapped SOL) */
    postSwapInstructions: TransactionInstruction[];
    /** All instructions combined for atomic execution */
    allInstructions: TransactionInstruction[];
    /** Address lookup tables from lending protocol */
    lookupTables: any[];
    /** Projected risk metrics AFTER the loop completes */
    projectedRisk: RiskMetrics;
    /** Estimated SOL received from swap (before slippage) */
    estimatedSwapOutputSol: number;
    /** Total SOL collateral after loop */
    totalCollateralSol: number;
    /** Total USDC debt after loop */
    totalDebtUsdc: number;
}

/**
 * Fetches Jupiter swap instructions for USDC → SOL.
 * Uses the Jupiter V6 Quote + Swap API.
 */
async function getJupiterSwapInstructions(
    userPublicKey: PublicKey,
    inputAmountUsdc: number,
    slippageBps: number
): Promise<{
    instructions: TransactionInstruction[];
    estimatedOutputSol: number;
}> {
    // 1. Get quote
    const inputAmountLamports = Math.floor(inputAmountUsdc * 1e6);
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${USDC_MINT}&outputMint=${SOL_MINT}&amount=${inputAmountLamports}&slippageBps=${slippageBps}`;

    const quoteResp = await fetch(quoteUrl);
    if (!quoteResp.ok) {
        throw new Error(`Jupiter quote failed: ${quoteResp.status}`);
    }
    const quoteData = await quoteResp.json();

    if (!quoteData || !quoteData.outAmount) {
        throw new Error("Jupiter quote returned no output amount");
    }

    const estimatedOutputSol = parseInt(quoteData.outAmount) / 1e9;

    // 2. Get swap instructions
    const swapResp = await fetch("https://quote-api.jup.ag/v6/swap-instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            quoteResponse: quoteData,
            userPublicKey: userPublicKey.toBase58(),
            wrapAndUnwrapSol: true,
        }),
    });

    if (!swapResp.ok) {
        throw new Error(`Jupiter swap-instructions failed: ${swapResp.status}`);
    }

    const swapData = await swapResp.json();

    // Parse serialized instructions
    const instructions: TransactionInstruction[] = [];

    // Setup instructions
    if (swapData.setupInstructions) {
        for (const ix of swapData.setupInstructions) {
            instructions.push(deserializeInstruction(ix));
        }
    }

    // Main swap instruction
    if (swapData.swapInstruction) {
        instructions.push(deserializeInstruction(swapData.swapInstruction));
    }

    // Cleanup instructions
    if (swapData.cleanupInstruction) {
        instructions.push(deserializeInstruction(swapData.cleanupInstruction));
    }

    return { instructions, estimatedOutputSol };
}

/**
 * Deserializes a Jupiter instruction from the API response format.
 */
function deserializeInstruction(ix: any): TransactionInstruction {
    return new TransactionInstruction({
        programId: new PublicKey(ix.programId),
        keys: ix.accounts.map((acc: any) => ({
            pubkey: new PublicKey(acc.pubkey),
            isSigner: acc.isSigner,
            isWritable: acc.isWritable,
        })),
        data: Buffer.from(ix.data, "base64"),
    });
}

/**
 * Builds a leverage loop transaction.
 *
 * This composes all four steps into a single atomic transaction:
 *   Step 1: Deposit initial SOL
 *   Step 2: Borrow USDC
 *   Step 3: Swap USDC → SOL (Jupiter)
 *   Step 4: Deposit swapped SOL
 *
 * The caller should then:
 *   1. Run simulation via the standard lifecycle
 *   2. Show projected HF in preview
 *   3. Confirm via the standard executor
 */
export async function buildLeverageLoop(
    input: LeverageLoopInput
): Promise<LeverageLoopResult> {
    const {
        vaultId,
        positionId,
        userPublicKey,
        connection,
        initialDepositSol,
        borrowAmountUsdc,
        solPrice,
        currentCollateralRaw,
        currentDebtRaw,
        slippageBps = 50, // 0.5% default
    } = input;

    // ── Step 1: Build Deposit IX ──────────────────────────────
    const colLamports = new BN(Math.floor(initialDepositSol * Math.pow(10, SOL_DECIMALS)));
    const { ixs: depositIxs, addressLookupTableAccounts: depositLUTs } = await getOperateIx({
        vaultId,
        positionId,
        colAmount: colLamports,
        debtAmount: new BN(0),
        signer: userPublicKey,
        connection,
    });

    // ── Step 2: Build Borrow IX ──────────────────────────────
    const debtLamports = new BN(Math.floor(borrowAmountUsdc * Math.pow(10, USDC_DECIMALS)));
    const { ixs: borrowIxs, addressLookupTableAccounts: borrowLUTs } = await getOperateIx({
        vaultId,
        positionId,
        colAmount: new BN(0),
        debtAmount: debtLamports,
        signer: userPublicKey,
        connection,
    });

    const preSwapInstructions = [...depositIxs, ...borrowIxs];

    // ── Step 3: Jupiter Swap USDC → SOL ──────────────────────
    const { instructions: swapInstructions, estimatedOutputSol } =
        await getJupiterSwapInstructions(userPublicKey, borrowAmountUsdc, slippageBps);

    // ── Step 4: Re-Deposit Swapped SOL ───────────────────────
    const swapOutputLamports = new BN(Math.floor(estimatedOutputSol * Math.pow(10, SOL_DECIMALS)));
    const { ixs: reDepositIxs } = await getOperateIx({
        vaultId,
        positionId,
        colAmount: swapOutputLamports,
        debtAmount: new BN(0),
        signer: userPublicKey,
        connection,
    });

    const postSwapInstructions = reDepositIxs;

    // ── Combine All Instructions ─────────────────────────────
    const allInstructions = [
        ...preSwapInstructions,
        ...swapInstructions,
        ...postSwapInstructions,
    ];

    // Merge lookup tables
    const lookupTables = [...depositLUTs, ...borrowLUTs];

    // ── Calculate Projected Risk ─────────────────────────────
    const totalNewCollateralSol = initialDepositSol + estimatedOutputSol;
    const totalCollateralSol =
        currentCollateralRaw.toNumber() / Math.pow(10, SOL_DECIMALS) + totalNewCollateralSol;
    const totalDebtUsdc =
        currentDebtRaw.toNumber() / Math.pow(10, USDC_DECIMALS) + borrowAmountUsdc;

    const projectedRisk = calculateProjectedRisk({
        currentCollateralAmount: currentCollateralRaw,
        currentDebtAmount: currentDebtRaw,
        collateralDecimals: SOL_DECIMALS,
        debtDecimals: USDC_DECIMALS,
        collateralPrice: solPrice,
        debtPrice: 1,
        liquidationThreshold: LIQUIDATION_THRESHOLDS[SOL_MINT],
        // We model the entire loop as a combined deposit + borrow
        // Using deposit as the operation type and manually computing the effect
        operation: "deposit",
        amount: totalNewCollateralSol,
    });

    // Re-calculate with the actual debt increase factored in
    const adjustedRisk = calculateProjectedRisk({
        currentCollateralAmount: currentCollateralRaw.add(
            new BN(Math.floor(totalNewCollateralSol * Math.pow(10, SOL_DECIMALS)))
        ),
        currentDebtAmount: currentDebtRaw,
        collateralDecimals: SOL_DECIMALS,
        debtDecimals: USDC_DECIMALS,
        collateralPrice: solPrice,
        debtPrice: 1,
        liquidationThreshold: LIQUIDATION_THRESHOLDS[SOL_MINT],
        operation: "borrow",
        amount: borrowAmountUsdc,
    });

    return {
        preSwapInstructions,
        swapInstructions,
        postSwapInstructions,
        allInstructions,
        lookupTables,
        projectedRisk: adjustedRisk,
        estimatedSwapOutputSol: estimatedOutputSol,
        totalCollateralSol,
        totalDebtUsdc,
    };
}
