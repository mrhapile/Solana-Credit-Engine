
import { ComputeBudgetProgram, Connection, SendTransactionError, VersionedTransaction } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { buildLendingTransaction } from "./builder";
import { createVersionedTransaction } from "./transaction";
import { simulateTransaction } from "./simulation";
import { LendingTransactionInput, TxFailureType } from "./types";
import { estimatePriorityFee, getSolscanTxLink } from "../lib/solana";

export interface TransactionResult {
    signature: string;
    confirmed: boolean;
    logs: string[];
    link: string;
}

export class EngineError extends Error {
    public type: TxFailureType;
    public logs: string[];

    constructor(message: string, type: TxFailureType, logs: string[] = []) {
        super(message);
        this.type = type;
        this.logs = logs;
    }
}

/**
 * Orchestrates the entire lending transaction lifecycle:
 * Build -> Simulate -> Optimize -> Sign -> Send -> Confirm
 */
export async function executeLendingTransaction(
    connection: Connection,
    wallet: WalletContextState,
    input: LendingTransactionInput
): Promise<TransactionResult> {
    const { signTransaction, publicKey } = wallet;

    if (!publicKey || !signTransaction) {
        throw new EngineError("Wallet not connected or does not support signing", TxFailureType.Unknown);
    }

    // 1. Build Initial Transaction (Deterministic with Safety Margins)
    console.log("Building transaction...");
    const computedTx = await buildLendingTransaction(connection, input);

    // 2. Create Initial Versioned Transaction (Stateful: fetches blockhash)
    // We use the default (high) compute budget for simulation to ensure it doesn't fail on CUs.
    console.log("Fetching blockhash and compiling for simulation...");
    let transaction = await createVersionedTransaction(connection, computedTx, publicKey);

    // 3. Simulate (Safety Check & Compute Estimation)
    console.log("Simulating transaction...");
    const simulation = await simulateTransaction(connection, transaction);

    if (!simulation.success) {
        console.error("Simulation failed:", simulation.error, simulation.logs);
        // Extract meaningful error from logs if possible
        const failureMessage = simulation.error || "Transaction simulation failed";
        throw new EngineError(
            `Simulation failed: ${failureMessage}`,
            simulation.failureType || TxFailureType.SimulationFailure,
            simulation.logs
        );
    }

    // 4. Optimize Compute & Fees
    const unitsConsumed = simulation.unitsConsumed || 0;
    // Add 10% buffer to observed units
    const optimizedUnits = Math.ceil(unitsConsumed * 1.1);

    // Estimate priority fee dynamically
    const priorityFeeMicroLamports = await estimatePriorityFee(connection, computedTx.instructions);

    console.log(`Simulation successful. Units: ${unitsConsumed}, Optimized: ${optimizedUnits}, PriorityFee: ${priorityFeeMicroLamports}`);

    // Update compute budget instructions with optimized values
    computedTx.computeBudgetInstructions = [
        ComputeBudgetProgram.setComputeUnitLimit({
            units: optimizedUnits,
        }),
        ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: priorityFeeMicroLamports,
        }),
    ];

    // 5. Rebuild Transaction with Optimized Budget
    // We fetch a fresh blockhash to ensure maximum longevity for the user signature
    console.log("Rebuilding transaction with optimized compute budget...");
    transaction = await createVersionedTransaction(connection, computedTx, publicKey);

    // 6. User Signing
    // DO NOT trigger popup until we are sure simulation passed and budget is optimized.
    console.log("Requesting user signature...");
    let signedTx: VersionedTransaction;
    try {
        signedTx = await signTransaction(transaction);
    } catch (err: any) {
        throw new EngineError("User rejected transaction", TxFailureType.Unknown);
    }

    // 7. Send Transaction
    console.log("Sending transaction...");
    let signature: string;
    try {
        signature = await connection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: true, // We already simulated
            maxRetries: 3, // Basic retries
        });
    } catch (err: any) {
        console.error("Send failed:", err);
        let message = err.message;
        if (err instanceof SendTransactionError) {
            // Parse SendTransactionError logs if available
            const logs = err.logs || [];
            if (logs.length > 0) {
                message += ` Logs: ${logs.join(", ")}`;
            }
        }
        throw new EngineError(
            `Send failed: ${message}`,
            TxFailureType.RPCError
        );
    }

    console.log("Transaction sent:", signature);

    // 8. Confirm Transaction
    console.log("Confirming transaction...");
    try {
        // Await confirmation with "confirmed" commitment
        // This throws if it times out or expires
        const confirmation = await connection.confirmTransaction(signature, "confirmed");

        if (confirmation.value.err) {
            throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log("Transaction confirmed!");
        return {
            signature,
            confirmed: true,
            logs: simulation.logs, // Return simulation logs as reference if actual logs aren't fetched
            link: getSolscanTxLink(signature)
        };
    } catch (err: any) {
        console.error("Confirmation failed:", err);
        throw new EngineError(
            `Confirmation timed out or failed: ${err.message}`,
            TxFailureType.BlockhashExpired // Often means timeout/expiry
        );
    }
}
