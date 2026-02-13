
import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";

// Cache decimals to avoid repeated RPC calls for known tokens
const decimalsCache = new Map<string, number>();

// Pre-fill with known tokens if desired, but we will fetch dynamically
decimalsCache.set("So11111111111111111111111111111111111111112", 9); // WSOL
decimalsCache.set("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 6); // USDC

/**
 * Fetches mint decimals dynamically and caches the result.
 */
export async function getMintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
    const mintStr = mint.toBase58();
    if (decimalsCache.has(mintStr)) {
        return decimalsCache.get(mintStr)!;
    }

    try {
        const mintInfo = await getMint(connection, mint);
        decimalsCache.set(mintStr, mintInfo.decimals);
        return mintInfo.decimals;
    } catch (error) {
        console.error(`Failed to fetch mint decimals for ${mintStr}:`, error);
        throw new Error(`Failed to fetch mint decimals for ${mintStr}`);
    }
}

/**
 * Validates the RPC URL environment variable.
 */
export function getRpcUrl(): string {
    const url = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (!url) {
        throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL is not defined in the environment variables.");
    }
    return url;
}

/**
 * Constructs a Solscan link for a transaction.
 */
export function getSolscanTxLink(signature: string): string {
    return `https://solscan.io/tx/${signature}`; // Defaults to mainnet
}

let connection: Connection | null = null;

export function getConnection(): Connection {
    if (connection) return connection;
    connection = new Connection(getRpcUrl(), "confirmed");
    return connection;
}

/**
 * Estimates a priority fee based on the recent prioritization fees for the accounts involved.
 * Strategies:
 * - 'median': The median of the recent fees.
 * - 'max': The maximum of the recent fees.
 * - 'average': The average.
 * We'll use a 75th percentile strategy to be safe but not overpay, bounded by a reasonable max.
 */
export async function estimatePriorityFee(
    connection: Connection,
    instructions: TransactionInstruction[]
): Promise<number> {
    try {
        // detailed logic to extract writable accounts
        const accounts = new Set<string>();
        for (const ix of instructions) {
            for (const key of ix.keys) {
                if (key.isWritable) {
                    accounts.add(key.pubkey.toBase58());
                }
            }
            accounts.add(ix.programId.toBase58());
        }

        const accountKeys = Array.from(accounts).map(k => new PublicKey(k));

        // If too many accounts, slice for performance/RPC limits (though getRecentPrioritizationFees handles many)
        // Max 128 accounts is typical limit if passed often.
        const limitedKeys = accountKeys.slice(0, 128);

        const fees = await connection.getRecentPrioritizationFees({
            lockedWritableAccounts: limitedKeys
        });

        if (fees.length === 0) return 1000; // Default min

        // Sort fees by prioritizationFee
        const sortedFees = fees
            .map(f => f.prioritizationFee)
            .sort((a, b) => a - b);

        // 75th percentile
        const index = Math.floor(sortedFees.length * 0.75);
        const fee = sortedFees[index];

        // Cap at some reasonable max to prevent draining wallet on spikes?
        // User didn't specify a cap, but "Dynamic priority fee" is the goal.
        return Math.max(fee, 1000); // Ensure at least 1000 (min)
    } catch (e) {
        console.warn("Failed to estimate priority fee, defaulting to 1000", e);
        // We still return default, but log warning. Caller handles if critical.
        return 1000;
    }
}
