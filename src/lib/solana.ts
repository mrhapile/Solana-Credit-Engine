import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import { safeRpcCall } from "./rpcGuard";

// ── Mint-Decimal Cache ────────────────────────────────────────
// In-memory Map. Pre-seeded with known tokens; never fetches same mint twice.
const decimalsCache = new Map<string, number>();
decimalsCache.set("So11111111111111111111111111111111111111112", 9);  // WSOL
decimalsCache.set("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 6); // USDC

/**
 * Fetches mint decimals dynamically and caches the result.
 * Never fetches the same mint twice thanks to in-memory Map.
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

// ── RPC URL ───────────────────────────────────────────────────
export function getRpcUrl(): string {
    const url = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (!url) {
        throw new Error("NEXT_PUBLIC_SOLANA_RPC_URL is not defined in the environment variables.");
    }
    return url;
}

// ── Solscan Link ──────────────────────────────────────────────
export function getSolscanTxLink(signature: string): string {
    return `https://solscan.io/tx/${signature}`;
}

// ── Connection Singleton ──────────────────────────────────────
// Defaults to "processed" for lighter read-only queries.
// confirmTransaction callers explicitly pass "confirmed".
let connection: Connection | null = null;

export function getConnection(): Connection {
    if (connection) return connection;
    connection = new Connection(getRpcUrl(), "processed");
    return connection;
}

// ── Priority Fee Estimation ───────────────────────────────────
// Cached for 60s. Only called during transaction simulation (never on page load).
let priorityFeeCache: { fee: number; timestamp: number } | null = null;
const FEE_CACHE_TTL = 60_000;
const DEFAULT_FEE = 1000;

export async function estimatePriorityFee(
    connection: Connection,
    instructions: TransactionInstruction[]
): Promise<number> {
    const now = Date.now();

    // 1. Return cached value if fresh
    if (priorityFeeCache && now - priorityFeeCache.timestamp < FEE_CACHE_TTL) {
        console.debug("[Priority Fee] Using cached fee:", priorityFeeCache.fee);
        return priorityFeeCache.fee;
    }

    try {
        // Extract unique writable accounts + program IDs
        const accounts = new Set<string>();
        for (const ix of instructions) {
            for (const key of ix.keys) {
                if (key.isWritable) accounts.add(key.pubkey.toBase58());
            }
            accounts.add(ix.programId.toBase58());
        }

        const limitedKeys = Array.from(accounts)
            .slice(0, 128)
            .map(k => new PublicKey(k));

        // 2. Fetch via RPC Guard (spacing + retry + 429 protection)
        const fee = await safeRpcCall(async () => {
            const fees = await connection.getRecentPrioritizationFees({
                lockedWritableAccounts: limitedKeys,
            });

            if (fees.length === 0) return DEFAULT_FEE;

            const sorted = fees.map(f => f.prioritizationFee).sort((a, b) => a - b);
            const p75 = Math.floor(sorted.length * 0.75);
            return Math.max(sorted[p75], DEFAULT_FEE);
        }, {
            context: 'estimatePriorityFee',
            fallbackValue: priorityFeeCache?.fee || DEFAULT_FEE,
        });

        // 3. Update cache
        priorityFeeCache = { fee, timestamp: now };
        return fee;
    } catch (e) {
        console.warn("[Priority Fee] Estimation failed, using fallback.", e);
        return priorityFeeCache?.fee || DEFAULT_FEE;
    }
}
