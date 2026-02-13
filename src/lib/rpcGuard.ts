/**
 * rpcGuard.ts — Centralized RPC call wrapper.
 *
 * Features:
 *   • Global 200ms spacing between heavy RPC calls (prevents burst concurrency)
 *   • Max 2 retries with exponential back-off (500ms base)
 *   • Immediate stop on 429 rate-limit errors (no aggressive retry)
 *   • Optional fallback value when errors are recoverable
 */

// Global retry configuration
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 500;

// Spacing guard — enforces min 200ms gap between outbound heavy RPC calls
const SPACING_MS = 200;
let lastRpcCallTime = 0;

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

export async function safeRpcCall<T>(
    fn: () => Promise<T>,
    options: {
        fallbackValue?: T;
        context?: string;
    } = {}
): Promise<T> {
    // ── Spacing Guard ──────────────────────────────────────────
    const now = Date.now();
    const gap = now - lastRpcCallTime;
    if (gap < SPACING_MS) {
        await new Promise(resolve => setTimeout(resolve, SPACING_MS - gap));
    }
    lastRpcCallTime = Date.now();

    // ── Retry Loop ─────────────────────────────────────────────
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
        try {
            const result = await fn();
            lastRpcCallTime = Date.now(); // update after completion to space next call
            return result;
        } catch (error: any) {
            const isRateLimit =
                error?.message?.includes('429') || error?.code === 429;

            // ── 429: Stop immediately, surface user-friendly message ──
            if (isRateLimit) {
                console.warn(
                    `[RPC Guard] 429 rate limit in ${options.context || 'operation'}. Halting retries.`
                );
                if (options.fallbackValue !== undefined) return options.fallbackValue;
                throw new RpcError(
                    'RPC rate limit reached. Please retry in a few seconds.',
                    429
                );
            }

            // ── Last attempt or non-retriable → throw / fallback ──
            if (attempt === MAX_RETRIES) {
                console.error(
                    `[RPC Guard] Max retries (${MAX_RETRIES}) for ${options.context || 'operation'}:`,
                    error
                );
                if (options.fallbackValue !== undefined) return options.fallbackValue;
                throw error;
            }

            // ── Backoff before next attempt ──
            const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            console.warn(
                `[RPC Guard] Retry ${options.context || 'op'} in ${delay}ms (${attempt + 1}/${MAX_RETRIES})`
            );
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
        }
    }

    // Unreachable
    throw new Error('Unexpected RPC Guard exit');
}
