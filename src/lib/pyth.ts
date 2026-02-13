/**
 * pyth.ts — On-chain Pyth oracle price fetcher.
 *
 * Replaces REST-based price feeds (Jupiter/Coingecko) with on-chain
 * Pyth price account reads for SOL/USD.
 *
 * Features:
 *   • Fetches directly from Pyth on-chain price account via RPC
 *   • Parses price + exponent safely (no external SDK dependency)
 *   • 30-second in-memory cache
 *   • Graceful fallback if oracle is unavailable
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getConnection } from "./solana";
import { safeRpcCall } from "./rpcGuard";

// ── Pyth Price Account Addresses (Mainnet) ────────────────────
// SOL/USD: https://pyth.network/price-feeds/crypto-sol-usd
export const PYTH_SOL_USD_PRICE_ACCOUNT = new PublicKey(
    "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG"
);

// ── Cache ─────────────────────────────────────────────────────
const PYTH_CACHE_TTL_MS = 30_000; // 30 seconds
let pythPriceCache: { price: number; confidence: number; timestamp: number } | null = null;

// ── Pyth Account Data Layout ──────────────────────────────────
// Pyth price account V2 layout (simplified for price extraction):
//   Offset 0-31:   Magic, version, type, size
//   The actual price data offset depends on version.
//   For simplicity and reliability, we use the known offsets from
//   the Pyth V2 price account format.
//
// Layout (V2 Price Account):
//   Bytes 0-3:    magic (0xa1b2c3d4)
//   Bytes 4-7:    version
//   Bytes 8-11:   type
//   Bytes 12-15:  size
//   Bytes 16-47:  price_type, exponent, ...
//   ...
//   Aggregate price at known offset
//
// We use a battle-tested parsing approach.

interface PythPrice {
    price: number;
    confidence: number;
    exponent: number;
    status: number;
}

/**
 * Parses a Pyth V2 on-chain price account.
 * Returns the aggregate price, confidence, and exponent.
 */
export function parsePythPriceAccount(data: Buffer): PythPrice | null {
    try {
        // Minimum account size check
        if (data.length < 200) return null;

        // Magic number check: 0xa1b2c3d4 (LE)
        const magic = data.readUInt32LE(0);
        if (magic !== 0xa1b2c3d4) {
            // Might be a V1 or unknown format
            console.warn("[Pyth] Unknown magic:", magic.toString(16));
            return null;
        }

        // Exponent at offset 20 (int32)
        const exponent = data.readInt32LE(20);

        // Number of price components at offset 24 (uint32)
        // const numComponents = data.readUInt32LE(24);

        // Aggregate price data starts at offset 208 in V2 accounts
        // aggregate.price (int64 LE) at offset 208
        // aggregate.conf  (uint64 LE) at offset 216
        // aggregate.status (uint32 LE) at offset 224

        const AGGREGATE_PRICE_OFFSET = 208;

        // Read price as int64 (LE) — use BigInt for safety
        const priceBigInt = data.readBigInt64LE(AGGREGATE_PRICE_OFFSET);
        const confBigInt = data.readBigUInt64LE(AGGREGATE_PRICE_OFFSET + 8);
        const status = data.readUInt32LE(AGGREGATE_PRICE_OFFSET + 16);

        const price = Number(priceBigInt);
        const confidence = Number(confBigInt);

        return { price, confidence, exponent, status };
    } catch (err) {
        console.error("[Pyth] Failed to parse price account:", err);
        return null;
    }
}

/**
 * Fetches the SOL/USD price from the Pyth on-chain oracle.
 * Returns price in standard USD units (e.g., 150.23).
 * Caches for 30 seconds.
 */
export async function fetchPythSolPrice(): Promise<{
    price: number;
    confidence: number;
    source: "pyth";
}> {
    const now = Date.now();

    // Check cache
    if (pythPriceCache && now - pythPriceCache.timestamp < PYTH_CACHE_TTL_MS) {
        return {
            price: pythPriceCache.price,
            confidence: pythPriceCache.confidence,
            source: "pyth",
        };
    }

    const connection = getConnection();

    const accountInfo = await safeRpcCall(
        () => connection.getAccountInfo(PYTH_SOL_USD_PRICE_ACCOUNT),
        { context: "pythPriceAccount" }
    );

    if (!accountInfo || !accountInfo.data) {
        throw new Error("[Pyth] SOL/USD price account not found or empty");
    }

    const parsed = parsePythPriceAccount(Buffer.from(accountInfo.data));
    if (!parsed) {
        throw new Error("[Pyth] Failed to parse SOL/USD price data");
    }

    // Status 1 = Trading (active price)
    if (parsed.status !== 1) {
        console.warn(`[Pyth] Price status is ${parsed.status} (not trading)`);
    }

    // Convert to standard price: price * 10^exponent
    const normalizedPrice = parsed.price * Math.pow(10, parsed.exponent);
    const normalizedConf = parsed.confidence * Math.pow(10, parsed.exponent);

    if (normalizedPrice <= 0 || isNaN(normalizedPrice)) {
        throw new Error(`[Pyth] Invalid normalized price: ${normalizedPrice}`);
    }

    // Update cache
    pythPriceCache = {
        price: normalizedPrice,
        confidence: normalizedConf,
        timestamp: now,
    };

    return {
        price: normalizedPrice,
        confidence: normalizedConf,
        source: "pyth",
    };
}

/**
 * Get SOL price with Pyth as primary, REST API as fallback.
 * This is the function that should replace all direct REST price calls.
 */
export async function getSolPrice(): Promise<number> {
    try {
        const { price } = await fetchPythSolPrice();
        return price;
    } catch (err) {
        console.warn("[Pyth] Oracle unavailable, falling back to REST:", err);
        // Fallback: try Jupiter REST
        try {
            const resp = await fetch(
                `https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112`
            );
            const json = await resp.json();
            const price = parseFloat(json?.data?.["So11111111111111111111111111111111111111112"]?.price);
            if (!isNaN(price) && price > 0) return price;
        } catch { /* fall through */ }

        // If both fail, check cache
        if (pythPriceCache) return pythPriceCache.price;

        throw new Error("All price sources unavailable");
    }
}

/**
 * Clears the price cache (for testing purposes).
 */
export function clearPythPriceCache() {
    pythPriceCache = null;
}
