
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { ComputedTransaction } from "./types";

/**
 * Converts a ComputedTransaction into a ready-to-sign VersionedTransaction.
 * This function handles fetching the latest blockhash, which makes it stateful.
 */
export async function createVersionedTransaction(
    connection: Connection,
    computed: ComputedTransaction,
    payer: PublicKey
): Promise<VersionedTransaction> {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const messageV0 = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: blockhash,
        instructions: [
            ...computed.computeBudgetInstructions,
            ...computed.instructions
        ],
    }).compileToV0Message(computed.lookupTables);

    return new VersionedTransaction(messageV0);
}
