

import {
    Connection,
    TransactionInstruction,
    SystemProgram,
    ComputeBudgetProgram,
    PublicKey
} from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createSyncNativeInstruction,
    NATIVE_MINT,
} from "@solana/spl-token";
import { getOperateIx } from "@jup-ag/lend/borrow";
import BN from "bn.js";
import { ComputedTransaction, LendingTransactionInput } from "./types";
import { getMintDecimals } from "../lib/solana";
import { USDC_MINT, SOL_MINT } from "./constants";

// Default configuration for INITIAL simulation (safe upper bound)
const SIMULATION_COMPUTE_UNITS = 1_400_000;
const DEFAULT_PRIORITY_FEE = 1000; // Micro-lamports

/**
 * Deterministic Transaction Builder for Lending Operations
 * 
 * @param connection Solana connection object
 * @param input LendingTransactionInput
 * @returns ComputedTransaction
 */
export async function buildLendingTransaction(
    connection: Connection,
    input: LendingTransactionInput
): Promise<ComputedTransaction> {
    const {
        vaultId,
        positionId,
        colAmount,
        debtAmount,
        userPublicKey,
        priorityFeeMicroLamports,
        computeUnits,
        preInstructions: extraPreInstructions = [],
        postInstructions: extraPostInstructions = []
    } = input;

    // 1. Fetch Dynamic Mint Info
    // We fetch decimals for SOL and USDC dynamically to avoid hardcoding.
    const [solDecimals, usdcDecimals] = await Promise.all([
        getMintDecimals(connection, new PublicKey(SOL_MINT)),
        getMintDecimals(connection, new PublicKey(USDC_MINT))
    ]);

    // 2. Normalize Amounts
    const colLamports = new BN(Math.floor(colAmount * Math.pow(10, solDecimals)));
    const debtLamports = new BN(Math.floor(debtAmount * Math.pow(10, usdcDecimals)));

    // 3. Build Core Lending Instructions
    const { ixs, addressLookupTableAccounts } = await getOperateIx({
        vaultId,
        positionId,
        colAmount: colLamports,
        debtAmount: debtLamports,
        signer: userPublicKey,
        connection,
    });

    // 4. Handle SOL Wrapping (Deterministic Logic)
    const preInstructions: TransactionInstruction[] = [];

    if (colAmount > 0) {
        const wsolAccount = getAssociatedTokenAddressSync(NATIVE_MINT, userPublicKey);

        // Check availability
        const accountInfo = await connection.getAccountInfo(wsolAccount);

        if (!accountInfo) {
            preInstructions.push(
                createAssociatedTokenAccountInstruction(
                    userPublicKey,
                    wsolAccount,
                    userPublicKey,
                    NATIVE_MINT
                )
            );
        }

        // Transfer SOL to WSOL account
        preInstructions.push(
            SystemProgram.transfer({
                fromPubkey: userPublicKey,
                toPubkey: wsolAccount,
                lamports: colLamports.toNumber(),
            })
        );

        // Sync native to update balance
        preInstructions.push(createSyncNativeInstruction(wsolAccount));
    }

    // 5. Compute Budget Instructions
    // If computeUnits is provided, use it. Otherwise use safe upper bound for simulation.
    // The executor is responsible for optimizing this after simulation.
    const finalComputeUnits = computeUnits || SIMULATION_COMPUTE_UNITS;

    // Prioritization fees should be dynamic. 
    // If not provided, we default to a minimal value, but the executor should optimize this.
    const finalPriorityFee = priorityFeeMicroLamports || DEFAULT_PRIORITY_FEE;

    const computeBudgetInstructions = [
        ComputeBudgetProgram.setComputeUnitLimit({
            units: finalComputeUnits,
        }),
        ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: finalPriorityFee,
        }),
    ];

    // 6. Assemble
    const instructions = [...preInstructions, ...extraPreInstructions, ...ixs, ...extraPostInstructions];

    return {
        instructions,
        computeBudgetInstructions,
        lookupTables: addressLookupTableAccounts,
        metadata: {
            expectedColLamports: colLamports,
            expectedDebtLamports: debtLamports,
            computeUnits: finalComputeUnits,
            priorityFeeMicroLamports: finalPriorityFee,
        }
    };
}
