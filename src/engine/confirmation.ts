
import { Connection, TransactionSignature } from "@solana/web3.js";
import { SIMULATION_RETRY_DELAY, MAX_CONFIRMATION_ATTEMPTS } from "./constants";

/**
 * Polls for transaction confirmation with exponential backoff.
 */
export async function confirmTransaction(
    connection: Connection,
    signature: TransactionSignature
): Promise<boolean> {
    let attempts = 0;
    let delay = SIMULATION_RETRY_DELAY; // Start with 1s

    while (attempts < MAX_CONFIRMATION_ATTEMPTS) {
        try {
            const status = await connection.getSignatureStatus(signature, {
                searchTransactionHistory: true,
            });

            if (status.value?.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
            }

            if (
                status.value?.confirmationStatus === "confirmed" ||
                status.value?.confirmationStatus === "finalized"
            ) {
                return true;
            }
        } catch (e: any) {
            // If it's the error we just threw, rethrow it
            if (e.message.startsWith("Transaction failed:")) throw e;

            // Otherwise, it's a transient failure (e.g. RPC timeout), just wait and retry
            console.warn("Confirmation check failed, retrying...", e);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));

        attempts++;
        // Cap delay at 5s
        delay = Math.min(delay * 1.5, 5000);
    }

    throw new Error("Transaction confirmation timed out after max attempts.");
}
