
export interface PriceResult {
    price: number;
    source: "jupiter" | "coingecko";
}

interface PriceCache {
    result: PriceResult;
    timestamp: number;
}

const CACHE_DURATION_MS = 60 * 1000; // 1 minute cache
let solPriceCache: PriceCache | null = null;
const SOL_MINT_ADDRESS = "So11111111111111111111111111111111111111112";

/**
 * Fetches with a 5000ms timeout.
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}) {
    // 5 seconds timeout
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

/**
 * Fetches the current SOL price from Jupiter Price API v4, failing over to Coingecko.
 * Uses a simple in-memory cache to prevent spamming.
 */
export async function fetchSolPrice(): Promise<PriceResult> {
    const now = Date.now();

    // Check cache
    if (solPriceCache && (now - solPriceCache.timestamp < CACHE_DURATION_MS)) {
        return solPriceCache.result;
    }

    // Try Jupiter V4
    try {
        const response = await fetchWithTimeout(
            `https://price.jup.ag/v4/price?ids=${SOL_MINT_ADDRESS}`
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Jupiter API Error [${response.status}]:`, errorText);
            throw new Error(`Jupiter API Error: ${response.status}`);
        }

        const data = await response.json();
        // V4 format: { data: { "So111...": { id, type, price, ... } } }
        // Note: The endpoint returns keys by mint
        const coinData = data?.data?.[SOL_MINT_ADDRESS];

        if (!coinData || !coinData.price) {
            throw new Error("Invalid price data structure from Jupiter API v4");
        }

        const price = parseFloat(coinData.price);
        if (isNaN(price)) {
            throw new Error("Price is NaN");
        }

        const result: PriceResult = { price, source: "jupiter" };

        solPriceCache = {
            result,
            timestamp: now
        };

        return result;

    } catch (jupiterError: any) {
        console.warn("Jupiter API failed, trying Coingecko fallback...", jupiterError);

        // Fallback: Coingecko
        try {
            const response = await fetchWithTimeout(
                "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Coingecko API Error [${response.status}]:`, errorText);
                throw new Error(`Coingecko API Error: ${response.status}`);
            }

            const data = await response.json();
            const price = data?.solana?.usd;

            if (typeof price !== "number" || isNaN(price)) {
                throw new Error("Invalid price data from Coingecko");
            }

            const result: PriceResult = { price, source: "coingecko" };

            // Allow caching fallback result too (optional: maybe cache for shorter time?)
            // We'll stick to 60s for simplicity as requested.
            solPriceCache = {
                result,
                timestamp: now
            };

            return result;

        } catch (coingeckoError: any) {
            console.error("Coingecko API failed:", coingeckoError);
            throw new Error("All price APIs failed. Please check your connection.");
        }
    }
}
