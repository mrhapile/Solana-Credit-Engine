import { Connection } from "@solana/web3.js";

// Global retry configuration
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 500;

class RpcError extends Error {
    public code?: number;
    public logs?: string[];

    constructor(message: string, code?: number, logs?: string[]) {
        super(message);
        this.name = 'RpcError';
        this.code = code;
        this.logs = logs;
    }
}

/**
 * Wraps an RPC call with retry logic and rate limit protection.
 * 
 * @param fn The async function to execute.
 * @param options configuration options.
 */
export async function safeRpcCall<T>(
    fn: () => Promise<T>,
    options: {
        fallbackValue?: T;
        context?: string;
    } = {}
): Promise<T> {
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
        try {
            return await fn();
        } catch (error: any) {
            // Analyze error
            const isRateLimit = error?.message?.includes('429') || error?.code === 429;

            if (isRateLimit) {
                console.warn(`[RPC Guard] Rate limit hit in ${options.context || 'operation'}. Stopping retries.`);
                if (options.fallbackValue !== undefined) {
                    return options.fallbackValue;
                }
                throw new RpcError("RPC rate limit reached. Please retry in a few seconds.", 429);
            }

            // If it's the last attempt or a non-retriable error (e.g. strict simulation failure), throw
            if (attempt === MAX_RETRIES) {
                console.error(`[RPC Guard] Max retries reached for ${options.context || 'operation'}:`, error);
                if (options.fallbackValue !== undefined) {
                    return options.fallbackValue;
                }
                throw error;
            }

            // Exponential backoff
            const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            console.warn(`[RPC Guard] Retrying ${options.context || 'operation'} in ${delay}ms... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delay));

            attempt++;
        }
    }

    // Should not be reachable
    throw new Error("Unexpected RPC Guard exit");
}
