
import { Connection, PublicKey, SendTransactionError, VersionedTransaction } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { buildLendingTransaction } from "./builder";
import { createVersionedTransaction } from "./transaction";
import { simulateTransaction } from "./simulation";
import { confirmTransaction } from "./confirmation";
import { LendingTransactionInput, TxFailureType } from "./types";

export interface TransactionResult {
    signature: string;
    confirmed: boolean;
    logs: string[];
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
 * Build -> Simulate -> Sign -> Send -> Confirm
 */
export async function executeLendingTransaction(
    connection: Connection,
    wallet: WalletContextState, // Using direct wallet context for now
    input: LendingTransactionInput
): Promise<TransactionResult> {
    const { signTransaction, publicKey } = wallet;

    if (!publicKey || !signTransaction) {
        throw new EngineError("Wallet not connected or does not support signing", TxFailureType.Unknown);
    }

    // 1. Build Transaction (Deterministic)
    console.log("Building transaction...");
    const computedTx = await buildLendingTransaction(connection, input);

    // 2. Create Versioned Transaction (Stateful: fetches blockhash)
    console.log("Fetching blockhash and compiling...");
    const transaction = await createVersionedTransaction(connection, computedTx, publicKey);

    // 3. Simulate (Safety Check)
    console.log("Simulating transaction...");
    const simulation = await simulateTransaction(connection, transaction);

    if (!simulation.success) {
        console.error("Simulation failed:", simulation.error, simulation.logs);
        throw new EngineError(
            `Simulation failed: ${simulation.error || "Unknown error"}`,
            simulation.failureType || TxFailureType.SimulationFailure,
            simulation.logs
        );
    }

    console.log("Simulation successful. Units consumed:", simulation.unitsConsumed);

    // 4. User Signing
    console.log("Requesting user signature...");
    let signedTx: VersionedTransaction;
    try {
        signedTx = await signTransaction(transaction);
    } catch (err: any) {
        throw new EngineError("User rejected transaction", TxFailureType.Unknown);
    }

    // 5. Send Transaction
    console.log("Sending transaction...");
    let signature: string;
    try {
        signature = await connection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: true, // We already simulated
            maxRetries: 3, // Basic retries on RPC level
        });
    } catch (err: any) {
        console.error("Send failed:", err);
        throw new EngineError(
            `Send failed: ${err.message}`,
            TxFailureType.RPCError
        );
    }

    console.log("Transaction sent:", signature);

    // 6. Confirm Transaction
    console.log("Confirming transaction...");
    try {
        const confirmed = await confirmTransaction(connection, signature);
        return {
            signature,
            confirmed,
            logs: simulation.logs // Return logs from simulation as "expected logs" if success
        };
    } catch (err: any) {
        console.error("Confirmation failed:", err);
        throw new EngineError(
            `Confirmation timed out or failed: ${err.message}`,
            TxFailureType.BlockhashExpired // Often means timeout/expiry
        );
    }
}
