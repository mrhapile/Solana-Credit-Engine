
import { Connection, VersionedTransaction, TransactionMessage } from "@solana/web3.js";
import { TxFailureType, SimulationResult, ComputedTransaction } from "./types";

/**
 * Simulates a transaction before sending to ensure determinism and catch errors early.
 */
export async function simulateTransaction(
    connection: Connection,
    transaction: VersionedTransaction
): Promise<SimulationResult> {
    try {
        const { value: simulation } = await connection.simulateTransaction(transaction, {
            replaceRecentBlockhash: true,
            commitment: "processed",
        });

        if (simulation.err) {
            const logs = simulation.logs || [];
            const errorStr = JSON.stringify(simulation.err);

            let failureType = TxFailureType.Unknown;

            // Basic Error Mapping Logic
            if (errorStr.includes("InstructionError") && logs.some(l => l.includes("Slippage"))) {
                failureType = TxFailureType.SlippageExceeded;
            } else if (errorStr.includes("InsufficientFunds") || logs.some(l => l.includes("0x1"))) { // 0x1 is often insufficient funds
                failureType = TxFailureType.InsufficientFunds;
            } else if (errorStr.includes("BlockhashNotFound")) {
                failureType = TxFailureType.BlockhashExpired;
            } else {
                failureType = TxFailureType.SimulationFailure;
            }

            return {
                success: false,
                failureType,
                logs,
                error: errorStr
            };
        }

        return {
            success: true,
            logs: simulation.logs || [],
            unitsConsumed: simulation.unitsConsumed
        };

    } catch (e: any) {
        return {
            success: false,
            failureType: TxFailureType.RPCError,
            logs: [],
            error: e.message || "Unknown RPC Error"
        };
    }
}
